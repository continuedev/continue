import { randomUUID } from "node:crypto";
import * as http from "node:http";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ContinueConfig, Tool, ToolCall } from "../index.js";

/**
 * Everything the MCP server needs from the running Core instance. Kept as a
 * narrow interface (rather than a reference to Core itself) so this module
 * stays testable and doesn't create a circular import with core.ts.
 */
export interface ShadowCodeToolsRuntime {
  loadConfig: () => Promise<ContinueConfig | undefined>;
  /** Executes a tool call exactly the way the normal `tools/call` IPC path does. */
  executeTool: (
    toolCall: ToolCall,
    sessionId: string | undefined,
  ) => Promise<{
    contextItems: { content: string }[];
    errorMessage: string | undefined;
  }>;
  /**
   * Asks the GUI to resolve the tool policy for this call (reusing the same
   * policy/settings logic normal tool calls go through) and, if the policy
   * requires it, to show an approval prompt and wait for the user's decision.
   * Resolves immediately for auto-approved/auto-disabled tools.
   */
  requestApproval: (params: {
    approvalId: string;
    toolCallId: string;
    sessionId: string | undefined;
    toolName: string;
    args: Record<string, unknown>;
    displayTitle?: string;
    wouldLikeTo?: string;
  }) => Promise<{ approved: boolean }>;
}

function toolToMcpSchema(tool: Tool) {
  return {
    name: tool.function.name,
    description: tool.function.description ?? "",
    inputSchema: tool.function.parameters ?? { type: "object", properties: {} },
  };
}

/**
 * Hosts Continue's own built-in tools as an MCP server, so that a `claude -p`
 * subprocess (see core/llm/llms/ClaudeCodeCli.ts) can be pointed at it via
 * `--mcp-config` instead of using Claude Code's own built-in Read/Write/Edit/
 * Bash tools. Every tool call still goes through Continue's existing
 * execution + approval path (this.runtime.executeTool / requestApproval) -
 * Claude Code CLI itself never touches the filesystem or a shell directly.
 *
 * Runs as a stateless Streamable HTTP MCP server bound to 127.0.0.1 inside
 * Core's own process, so tool execution has direct access to the same
 * config/messenger state `handleToolCall` uses - no extra process, no new
 * cross-process IPC.
 */
export class ShadowCodeToolsMcpServer {
  private httpServer: http.Server | undefined;
  private transport: StreamableHTTPServerTransport | undefined;
  private url: string | undefined;
  private startPromise: Promise<string> | undefined;

  // The set of tools actually active for a given Continue session/turn
  // (e.g. augmentedOptions.tools from tokenOptimizedStreamChat, which
  // includes any tool overrides plus the force-included shadow_* tools) -
  // registered by ClaudeCodeCli right before spawning `claude` for that
  // session. Falls back to the full config.tools list if nothing was
  // registered (e.g. a stale/unknown session id).
  private toolsBySession = new Map<string, Tool[]>();

  constructor(private readonly runtime: ShadowCodeToolsRuntime) {}

  registerToolsForSession(sessionId: string, tools: Tool[]) {
    this.toolsBySession.set(sessionId, tools);
  }

  unregisterSession(sessionId: string) {
    this.toolsBySession.delete(sessionId);
  }

  private async resolveTools(sessionId: string | undefined): Promise<Tool[]> {
    if (sessionId && this.toolsBySession.has(sessionId)) {
      return this.toolsBySession.get(sessionId)!;
    }
    const config = await this.runtime.loadConfig();
    return config?.tools ?? [];
  }

  /** Idempotent: safe to call on every provider invocation. */
  async ensureStarted(): Promise<string> {
    if (this.url) {
      return this.url;
    }
    if (!this.startPromise) {
      this.startPromise = this.start();
    }
    return this.startPromise;
  }

  private buildMcpServer(): Server {
    const server = new Server(
      { name: "shadow-code", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const sessionId = (request.params?._meta as any)?.continueSessionId as
        | string
        | undefined;
      const tools = await this.resolveTools(sessionId);
      return { tools: tools.map(toolToMcpSchema) };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // The URL carries the originating Continue session id (see getUrlForSession).
      const sessionId = (request.params._meta as any)?.continueSessionId as
        | string
        | undefined;

      const tools = await this.resolveTools(sessionId);
      const tool = tools.find((t) => t.function.name === name);

      if (!tool) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
      }

      const toolCallId = randomUUID();
      const approvalId = randomUUID();

      const { approved } = await this.runtime.requestApproval({
        approvalId,
        toolCallId,
        sessionId,
        toolName: tool.function.name,
        args: args ?? {},
        displayTitle: tool.displayTitle,
        wouldLikeTo: tool.wouldLikeTo,
      });

      if (!approved) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool call "${tool.function.name}" was not approved.`,
            },
          ],
        };
      }

      const toolCall: ToolCall = {
        id: toolCallId,
        type: "function",
        function: {
          name: tool.function.name,
          arguments: JSON.stringify(args ?? {}),
        },
      };

      const result = await this.runtime.executeTool(toolCall, sessionId);

      if (result.errorMessage) {
        return {
          isError: true,
          content: [{ type: "text", text: result.errorMessage }],
        };
      }

      return {
        content: result.contextItems.map((item) => ({
          type: "text" as const,
          text: item.content,
        })),
      };
    });

    return server;
  }

  private async start(): Promise<string> {
    const mcpServer = this.buildMcpServer();
    // NOTE: stateless mode (sessionIdGenerator: undefined) is broken on
    // Windows in the installed SDK version - the transport silently 500s on
    // every request after the first on the same server instance (confirmed
    // via direct repro, unrelated to Claude Code CLI). Stateful mode doesn't
    // hit this; the `mcp-session-id` it negotiates is purely a transport-
    // level connection id and is unrelated to `continueSessionId` below
    // (which identifies the Continue conversation, carried via query param
    // and threaded into every request's `_meta` regardless of transport
    // session).
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await mcpServer.connect(this.transport);

    this.httpServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = body ? JSON.parse(body) : undefined;
        const sessionId = new URL(
          req.url ?? "/",
          "http://127.0.0.1",
        ).searchParams.get("continueSessionId");
        if (parsed && sessionId) {
          parsed.params = parsed.params ?? {};
          parsed.params._meta = {
            ...(parsed.params._meta ?? {}),
            continueSessionId: sessionId,
          };
        }
        void this.transport!.handleRequest(req, res, parsed);
      });
    });

    const port = await new Promise<number>((resolve, reject) => {
      this.httpServer!.once("error", reject);
      this.httpServer!.listen(0, "127.0.0.1", () => {
        const address = this.httpServer!.address();
        if (address && typeof address !== "string") {
          resolve(address.port);
        } else {
          reject(new Error("Failed to determine shadow-code MCP server port"));
        }
      });
    });

    this.url = `http://127.0.0.1:${port}/mcp`;
    return this.url;
  }

  /** URL to put in the generated --mcp-config for a given Continue session. */
  getUrlForSession(sessionId: string): string {
    if (!this.url) {
      throw new Error("ShadowCodeToolsMcpServer not started yet");
    }
    return `${this.url}?continueSessionId=${encodeURIComponent(sessionId)}`;
  }

  async stop(): Promise<void> {
    await this.transport?.close();
    await new Promise<void>((resolve) =>
      this.httpServer?.close(() => resolve()),
    );
    this.url = undefined;
    this.startPromise = undefined;
  }
}

// Module-level singleton: Core instantiates and starts this once; the
// ClaudeCodeCli LLM provider (constructed generically via llmFromDescription,
// with no reference to Core) reads it from here instead of threading a Core
// reference through every provider's constructor.
let instance: ShadowCodeToolsMcpServer | undefined;

export function setShadowCodeToolsMcpServer(server: ShadowCodeToolsMcpServer) {
  instance = server;
}

export function getShadowCodeToolsMcpServer(): ShadowCodeToolsMcpServer {
  if (!instance) {
    throw new Error(
      "ShadowCodeToolsMcpServer has not been initialized by Core yet",
    );
  }
  return instance;
}
