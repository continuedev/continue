import { Agent as HttpsAgent } from "https";

import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  HttpMcpServer,
  SseMcpServer,
  StdioMcpServer,
} from "node_modules/@continuedev/config-yaml/dist/schemas/mcp/index.js";

import { MCPConnectionInfo } from "./types.js";

/**
 * Env vars inherited from the parent process by stdio MCP servers.
 *
 * Mirrors COMMONS_ENV_VARS in core/context/mcp/MCPConnection.ts (b1f147c12).
 * The CLI previously inherited the *entire* parent environment (#8602), which
 * silently exposed every locally available secret (API keys, cloud
 * credentials, CI tokens, ...) to each stdio MCP server subprocess, since
 * servers are started from config without any approval gate on the process
 * itself. Only this small, non-sensitive set is inherited now.
 *
 * Servers that need additional variables should declare them explicitly via
 * their `env` block, e.g. referencing host/local env vars with
 * `${{ secrets.MY_VAR }}` (resolved from process.env and ~/.continue/.env,
 * see docs/customize/deep-dives/mcp.mdx).
 *
 * Set CONTINUE_CLI_MCP_INHERIT_ALL_ENV (any non-empty value) to opt back into
 * the previous full-inheritance behavior.
 */
const COMMONS_ENV_VARS = ["HOME", "USER", "USERPROFILE", "LOGNAME", "USERNAME"];

const INHERIT_ALL_ENV_VAR = "CONTINUE_CLI_MCP_INHERIT_ALL_ENV";

/**
 * Build the environment for a stdio MCP server subprocess:
 * COMMONS_ENV_VARS + PATH from the parent process, overlaid with the
 * server's explicitly configured env (explicit keys win, same precedence
 * as before). Does not mutate `serverEnv`.
 */
export function constructMcpChildEnv(
  serverEnv: Record<string, string> | undefined,
): Record<string, string> {
  if (process.env?.[INHERIT_ALL_ENV_VAR]) {
    // Explicit opt-in restoring the pre-fix behavior (#8602) of inheriting
    // the full parent environment. Only needed for servers that cannot
    // declare the variables they depend on.
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!(key in env) && !!value) {
        env[key] = value;
      }
    }
    return { ...env, ...(serverEnv ?? {}) };
  }

  const env: Record<string, string> = {};
  if (process.env) {
    for (const key of COMMONS_ENV_VARS) {
      const value = process.env[key];
      if (value !== undefined) {
        env[key] = value;
      }
    }
    if (process.env.PATH !== undefined) {
      env.PATH = process.env.PATH;
    }
  }

  return { ...env, ...(serverEnv ?? {}) };
}

export function constructSseTransport(
  serverConfig: SseMcpServer,
  apiKey: string | undefined,
): SSEClientTransport {
  const sseAgent =
    serverConfig.requestOptions?.verifySsl === false
      ? new HttpsAgent({ rejectUnauthorized: false })
      : undefined;

  const headers = {
    ...serverConfig.requestOptions?.headers,
    ...(apiKey && {
      Authorization: `Bearer ${apiKey}`,
    }),
  };

  return new SSEClientTransport(new URL(serverConfig.url), {
    eventSourceInit: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            ...headers,
          },
          ...(sseAgent && { agent: sseAgent }),
        }),
    },
    requestInit: {
      headers,
      ...(sseAgent && { agent: sseAgent }),
    },
  });
}

export function constructHttpTransport(
  serverConfig: HttpMcpServer,
  apiKey: string | undefined,
): StreamableHTTPClientTransport {
  const streamableAgent =
    serverConfig.requestOptions?.verifySsl === false
      ? new HttpsAgent({ rejectUnauthorized: false })
      : undefined;

  const headers = {
    ...serverConfig.requestOptions?.headers,
    ...(apiKey && {
      Authorization: `Bearer ${apiKey}`,
    }),
  };

  return new StreamableHTTPClientTransport(new URL(serverConfig.url), {
    requestInit: {
      headers,
      ...(streamableAgent && { agent: streamableAgent }),
    },
  });
}

export function constructStdioTransport(
  serverConfig: StdioMcpServer,
  connection: MCPConnectionInfo,
): StdioClientTransport {
  const env = constructMcpChildEnv(serverConfig.env);

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args || [],
    env,
    cwd: serverConfig.cwd,
    stderr: "pipe",
  });

  const stderrStream = transport.stderr;
  if (stderrStream) {
    stderrStream.on("data", (data: Buffer) => {
      const stderrOutput = data.toString().trim();
      if (stderrOutput) {
        connection.warnings.push(stderrOutput);
      }
    });
  }

  return transport;
}
