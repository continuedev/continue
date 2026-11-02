#!/usr/bin/env node
/**
 * MCP Remote SSH Terminal Server
 * 
 * Provides a `run_command` tool that executes shell commands on a remote SSH server
 * and captures stdout/stderr. This solves the limitation where Continue's built-in
 * `runTerminalCommand` tool cannot capture output in remote SSH environments.
 * 
 * The MCP server runs on the local Mac (where the extension host runs) and uses
 * SSH to execute commands on the remote server.
 * 
 * Usage:
 *   node server.js
 * 
 * Config (in ~/.continue/config.yaml):
 *   mcpServers:
 *     - name: remote-ssh-terminal
 *       command: node
 *       args:
 *         - /path/to/mcp-remote-ssh/server.js
 */

const { spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

// MCP SDK - try multiple resolution paths
let Server, StdioServerTransport, ListToolsRequestSchema, CallToolRequestSchema;

try {
  ({ Server } = require("@modelcontextprotocol/sdk/server/index.js"));
  ({ StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js"));
  ({ ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js"));
} catch (e) {
  // Fallback: try relative path (if SDK is in sibling core/node_modules)
  try {
    const sdkBase = "../core/node_modules/@modelcontextprotocol/sdk/dist/cjs";
    ({ Server } = require(`${sdkBase}/server/index.js`));
    ({ StdioServerTransport } = require(`${sdkBase}/server/stdio.js`));
    ({ ListToolsRequestSchema, CallToolRequestSchema } = require(`${sdkBase}/types.js`));
  } catch (e2) {
    console.error("Failed to load MCP SDK. Install with: npm install @modelcontextprotocol/sdk");
    console.error(e2.message);
    process.exit(1);
  }
}

// Remote SSH configuration
const REMOTE_HOST = process.env.REMOTE_SSH_HOST || "devops@devops-gpu-vt-tpb";
const REMOTE_SSH_OPTIONS = [
  "-o", "ConnectTimeout=10",
  "-o", "StrictHostKeyChecking=no",
  "-o", "BatchMode=yes",
];

// Default timeout: 2 minutes (same as Continue's built-in tool)
const DEFAULT_TIMEOUT_MS = 120_000;

// Max output size to prevent context overflow (100KB)
const MAX_OUTPUT_BYTES = 100_000;

/**
 * Execute a shell command on the remote server via SSH and capture stdout/stderr.
 */
function executeRemoteCommand(command, cwd, timeoutMs) {
  return new Promise((resolve) => {
    // Build SSH command
    // If cwd is provided, use it; otherwise use home directory
    const sshCommand = cwd 
      ? `cd '${cwd}' && ${command}`
      : command;
    
    const sshArgs = [
      ...REMOTE_SSH_OPTIONS,
      REMOTE_HOST,
      sshCommand,
    ];

    const child = spawn("ssh", sshArgs, {
      cwd: os.homedir(),
      env: {
        ...process.env,
        FORCE_COLOR: "0", // Disable colors for cleaner output
        NO_COLOR: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killed = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!killed) {
          child.kill("SIGKILL");
        }
      }, 5000);
    }, timeoutMs);

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      killed = true;

      // Truncate output if too large
      if (stdout.length > MAX_OUTPUT_BYTES) {
        stdout = stdout.slice(0, MAX_OUTPUT_BYTES) + "\n... [output truncated]";
      }
      if (stderr.length > MAX_OUTPUT_BYTES) {
        stderr = stderr.slice(0, MAX_OUTPUT_BYTES) + "\n... [output truncated]";
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        signal: signal || undefined,
        timedOut,
        remoteHost: REMOTE_HOST,
        cwd: cwd || "(home directory)",
      });
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      killed = true;
      resolve({
        stdout: "",
        stderr: error.message,
        exitCode: -1,
        error: error.message,
        remoteHost: REMOTE_HOST,
        cwd: cwd || "(home directory)",
      });
    });
  });
}

/**
 * Format the command result as readable text for the LLM.
 */
function formatResult(result) {
  const lines = [];

  if (result.error) {
    lines.push(`ERROR: ${result.error}`);
    return lines.join("\n");
  }

  if (result.timedOut) {
    lines.push(`[Timeout: command killed after ${DEFAULT_TIMEOUT_MS / 1000} seconds]`);
  }

  lines.push(`[Remote: ${result.remoteHost}]`);
  lines.push(`[CWD: ${result.cwd}]`);
  lines.push("");

  if (result.stdout) {
    lines.push(result.stdout);
  }

  if (result.stderr) {
    if (result.stdout) lines.push("");
    lines.push(`[stderr]`);
    lines.push(result.stderr);
  }

  if (!result.stdout && !result.stderr) {
    lines.push("[No output]");
  }

  lines.push("");
  lines.push(`[exit code: ${result.exitCode}${result.signal ? `, signal: ${result.signal}` : ""}]`);

  return lines.join("\n");
}

// --- MCP Server Setup ---

const server = new Server(
  { name: "remote-ssh-terminal", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_command",
      description:
        "Execute a shell command on the remote SSH server and capture stdout/stderr. " +
        "This works in remote SSH environments where the built-in terminal tool cannot capture output. " +
        `Remote host: ${REMOTE_HOST}`,
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute on the remote server",
          },
          cwd: {
            type: "string",
            description: "Working directory on the remote server (optional, defaults to home directory)",
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (optional, defaults to 120000)",
          },
        },
        required: ["command"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "run_command") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  const { command, cwd, timeout } = request.params.arguments;

  if (!command || typeof command !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'command' parameter is required" }],
      isError: true,
    };
  }

  const timeoutMs = timeout && typeof timeout === "number" ? timeout : DEFAULT_TIMEOUT_MS;

  try {
    const result = await executeRemoteCommand(command, cwd, timeoutMs);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error executing command: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`MCP Remote SSH Terminal Server running on stdio (remote: ${REMOTE_HOST})`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
