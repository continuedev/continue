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
  const env: Record<string, string> = serverConfig.env || {};
  if (process.env) {
    for (const [key, value] of Object.entries(process.env)) {
      if (!(key in env) && !!value) {
        env[key] = value;
      }
    }
  }

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
