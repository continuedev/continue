import { randomUUID } from "node:crypto";
import * as http from "node:http";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  ContinueConfig,
  Tool,
  ToolApprovalRequest,
  ToolCall,
} from "../index.js";

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
  requestApproval: (
    params: ToolApprovalRequest,
  ) => Promise<{ approved: boolean }>;
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
/** Used when a request arrives without a ?continueSessionId= query param. */
const DEFAULT_SESSION_KEY = "__default__";

interface RegisteredAgentRun {
  tools: Tool[];
  /**
   * The ShadowChatDb / Continue conversation id to attribute tool calls to.
   * Distinct from the map key: several subagents share one chat session but
   * each gets its own key so their tool registrations don't overwrite each
   * other's.
   */
  chatSessionId: string | undefined;
  /** Shown on the approval banner, e.g. a subagent's task description. */
  agentLabel?: string;
}

interface McpSession {
  server: Server;
  transport: StreamableHTTPServerTransport;
}

export class ShadowCodeToolsMcpServer {
  private httpServer: http.Server | undefined;
  private url: string | undefined;
  private startPromise: Promise<string> | undefined;

  // One MCP Server + transport per agent run, NOT one per process. The
  // transport is stateful (see start()), and a stateful transport binds to
  // exactly one MCP client: the SDK rejects a second `initialize` with
  // "Server already initialized" and close() never resets that flag. Sharing
  // one transport therefore caps the whole process at a single `claude`
  // subprocess, which makes parallel subagents impossible.
  private sessions = new Map<string, Promise<McpSession>>();

  // The set of tools actually active for a given agent run (e.g.
  // augmentedOptions.tools from tokenOptimizedStreamChat, which includes any
  // tool overrides plus the force-included shadow_* tools) - registered by
  // ClaudeCodeCli right before spawning `claude`. Falls back to the full
  // config.tools list if nothing was registered (e.g. a stale/unknown key).
  private runsByKey = new Map<string, RegisteredAgentRun>();

  constructor(private readonly runtime: ShadowCodeToolsRuntime) {}

  /**
   * @param key Identifies one agent run - CompletionOptions.agentRunId, or the
   * chat session id for the main turn. NOT the MCP transport's own session id.
   */
  registerToolsForSession(
    key: string,
    tools: Tool[],
    chatSessionId?: string,
    agentLabel?: string,
  ) {
    this.runsByKey.set(key, { tools, chatSessionId, agentLabel });
  }

  unregisterSession(key: string) {
    this.runsByKey.delete(key);

    const session = this.sessions.get(key);
    this.sessions.delete(key);
    // Tear down this run's transport/server so the port doesn't accumulate
    // dead MCP sessions for the life of the Core process.
    void session
      ?.then(async ({ server, transport }) => {
        await transport.close();
        await server.close();
      })
      .catch(() => {});
  }

  private async resolveTools(key: string): Promise<Tool[]> {
    const run = this.runsByKey.get(key);
    if (run) {
      return run.tools;
    }
    const config = await this.runtime.loadConfig();
    return config?.tools ?? [];
  }

  private resolveChatSessionId(key: string): string | undefined {
    return this.runsByKey.get(key)?.chatSessionId;
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

  // Each server instance serves exactly one agent run, so the key is captured
  // here rather than read out of every request's _meta.
  private buildMcpServer(key: string): Server {
    const server = new Server(
      { name: "shadow-code", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.resolveTools(key);
      return { tools: tools.map(toolToMcpSchema) };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const sessionId = this.resolveChatSessionId(key);
      const tools = await this.resolveTools(key);
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
        agentLabel: this.runsByKey.get(key)?.agentLabel,
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

  /**
   * One MCP Server + transport per agent run, created on that run's first
   * request. Stored as the in-flight promise so two concurrent requests for the
   * same key can't race into building two.
   */
  private getOrCreateSession(key: string): Promise<McpSession> {
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const created = (async (): Promise<McpSession> => {
      const server = this.buildMcpServer(key);
      // NOTE: stateless mode (sessionIdGenerator: undefined) is broken on
      // Windows in the installed SDK version - the transport silently 500s on
      // every request after the first on the same server instance (confirmed
      // via direct repro, unrelated to Claude Code CLI). Stateful mode doesn't
      // hit this; the `mcp-session-id` it negotiates is purely a transport-
      // level connection id, unrelated to the `continueSessionId` query param
      // that selects which run (and therefore which transport) a request
      // belongs to.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      await server.connect(transport);
      return { server, transport };
    })();

    this.sessions.set(key, created);
    // Don't cache a failed construction.
    created.catch(() => {
      if (this.sessions.get(key) === created) {
        this.sessions.delete(key);
      }
    });
    return created;
  }

  private async start(): Promise<string> {
    this.httpServer = http.createServer((req, res) => {
      // The query param selects which agent run - and therefore which MCP
      // transport - this request belongs to.
      const key =
        new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get(
          "continueSessionId",
        ) ?? DEFAULT_SESSION_KEY;

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("error", () => {
        // Client hung up mid-request; nothing useful left to do.
      });
      req.on("end", () => {
        void (async () => {
          try {
            // The body must be parsed here and handed to the transport: its
            // Node->Web request adapter cannot read the stream itself in this
            // runtime (it throws "res.body.getReader is not a function").
            let parsed: unknown;
            if (body) {
              try {
                parsed = JSON.parse(body);
              } catch {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    error: { code: -32700, message: "Parse error" },
                    id: null,
                  }),
                );
                return;
              }
            }

            const { transport } = await this.getOrCreateSession(key);
            await transport.handleRequest(req, res, parsed);
          } catch (e) {
            console.error("shadow-code-tools MCP request failed", e);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
            }
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
              }),
            );
          }
        })();
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

  /**
   * URL to put in the generated --mcp-config for a given agent run. The query
   * param is what routes the run to its own MCP transport.
   */
  getUrlForSession(key: string): string {
    if (!this.url) {
      throw new Error("ShadowCodeToolsMcpServer not started yet");
    }
    return `${this.url}?continueSessionId=${encodeURIComponent(key)}`;
  }

  async stop(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    this.runsByKey.clear();
    await Promise.all(
      sessions.map(async (pending) => {
        try {
          const { server, transport } = await pending;
          await transport.close();
          await server.close();
        } catch {
          // Already torn down - nothing to do.
        }
      }),
    );
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
