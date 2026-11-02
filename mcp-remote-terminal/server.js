#!/usr/bin/env node
/**
 * MCP Remote Terminal Server
 * 
 * Provides a `run_command` tool that executes shell commands and captures
 * stdout/stderr. Designed to run on the remote server where the VS Code
 * extension host runs (extensionKind: ["ui", "workspace"]).
 * 
 * This solves the limitation where Continue's built-in `runTerminalCommand`
 * tool cannot capture output in remote SSH environments.
 * 
 * Usage:
 *   node server.js
 * 
 * Config (in ~/.continue/config.yaml):
 *   mcpServers:
 *     - name: remote-terminal
 *       command: node
 *       args:
 *         - /path/to/mcp-remote-terminal/server.js
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

// Default timeout: 2 minutes (same as Continue's built-in tool)
const DEFAULT_TIMEOUT_MS = 120_000;

// Max output size to prevent context overflow (100KB)
const MAX_OUTPUT_BYTES = 100_000;

/**
 * Execute a shell command and capture stdout/stderr.
 * Uses the user's login shell to source .bashrc/.zshrc etc.
 */
function executeCommand(command, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "powershell.exe" : (process.env.SHELL || "/bin/bash");
    const args = isWindows
      ? ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command]
      : ["-l", "-c", command];

    // Build env with PATH that includes common node/conda locations
    // This ensures commands like `node`, `npm`, `conda` are available on remote
    const extraPaths = [
      "/data/dev/miniconda3/envs/node20/bin",
      "/data/dev/miniconda3/bin",
      "/usr/local/sbin",
      "/usr/local/bin",
      "/usr/sbin",
      "/usr/bin",
      "/sbin",
      "/bin",
    ].join(":");

    const child = spawn(shell, args, {
      cwd: cwd || os.homedir(),
      env: {
        ...process.env,
        PATH: `${process.env.PATH || ""}:${extraPaths}`,
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
        cwd: cwd || os.homedir(),
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
        cwd: cwd || os.homedir(),
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
  { name: "remote-terminal", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_command",
      description:
        "Execute a shell command on the remote server and capture stdout/stderr. " +
        "This works in remote SSH environments where the built-in terminal tool cannot capture output. " +
        "Uses the user's login shell (bash/zsh) with .bashrc/.zshrc sourced.",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
          cwd: {
            type: "string",
            description: "Working directory (optional, defaults to home directory)",
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
    const result = await executeCommand(command, cwd, timeoutMs);
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
  console.error("MCP Remote Terminal Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
