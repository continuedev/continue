import { decodeFQSN, getTemplateVariables } from "@continuedev/config-yaml";
import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  HttpMcpServer,
  SseMcpServer,
  StdioMcpServer,
} from "node_modules/@continuedev/config-yaml/dist/schemas/mcp/index.js";

import { isAuthenticated, loadAuthConfig } from "src/auth/workos.js";

import { get } from "../util/apiClient.js";
import { getErrorString } from "../util/error.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { isAuthError } from "./mcpUtils.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  MCPConnectionInfo,
  MCPServerConfig,
  MCPServiceState,
  SERVICE_NAMES,
} from "./types.js";

interface ServerConnection extends MCPConnectionInfo {
  client: Client | null;
}

export const EMPTY_MCP_STATE: MCPServiceState = {
  mcpService: null,
  connections: [],
  tools: [],
  prompts: [],
};

export class MCPService
  extends BaseService<MCPServiceState>
  implements ServiceWithDependencies
{
  private connections: Map<string, ServerConnection> = new Map();
  private assistant: AssistantConfig | null = null;
  private isShuttingDown = false;
  private isHeadless: boolean | undefined;
  private apiKeyCache: Map<string, string> = new Map();

  getDependencies(): string[] {
    return [SERVICE_NAMES.CONFIG, SERVICE_NAMES.AUTH];
  }
  constructor() {
    super("MCPService", {
      ...EMPTY_MCP_STATE,
    });

    // Register shutdown handler
    process.on("exit", () => this.cleanup());
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());
  }

  /**
   * Initialize the MCP service
   */
  async doInitialize(
    assistant: AssistantConfig,
    hasAgentFile: boolean,
    isHeadless: boolean | undefined,
  ): Promise<MCPServiceState> {
    this.isHeadless = isHeadless;

    await this.shutdownConnections();

    this.assistant = assistant;
    this.connections.clear();

    const connectionPromises = assistant.mcpServers?.map(async (config) => {
      if (config) {
        return await this.connectServer(config);
      }
    });

    const connectionInit = Promise.all(connectionPromises ?? []);
    if (isHeadless || hasAgentFile) {
      await connectionInit;

      if (isHeadless) {
        // With headless or agent, throw error if any MCP server failed to connect
        const failedConnections = Array.from(this.connections.values()).filter(
          (c) => c.status === "error",
        );
        if (failedConnections.length > 0) {
          const errorMessages = failedConnections.map(
            (c) => `${c.config?.name}: ${c.error}`,
          );
          throw new Error(
            `MCP server(s) failed to load:\n${errorMessages.join("\n")}`,
          );
        }
      }
    } else {
      this.updateState();
    }

    return this.currentState;
  }

  /**
   * Update internal state based on current connections
   */
  private updateState() {
    const connections: MCPConnectionInfo[] = Array.from(
      this.connections.values(),
    ).map(({ client: _, ...rest }) => rest);
    const connectedServers = connections.filter(
      (c) => c.status === "connected",
    );
    const tools = connectedServers.flatMap((s) => s.tools);
    const prompts = connectedServers.flatMap((s) => s.prompts);

    const newState: MCPServiceState = {
      mcpService: this,
      connections,
      tools,
      prompts,
    };
    this.setState(newState);
    serviceContainer.set(SERVICE_NAMES.MCP, newState);
  }

  /**
   * Get current MCP service state
   */
  getState(): MCPServiceState {
    return { ...this.currentState };
  }

  /**
   * Get overall status for UI indicator
   */
  getOverallStatus(): {
    status: "idle" | "connecting" | "connected" | "error";
    hasWarnings: boolean;
  } {
    const connections = Array.from(this.connections.values());
    const hasWarnings = connections.some((c) => c.warnings.length > 0);

    if (connections.some((c) => c.status === "connecting")) {
      return { status: "connecting", hasWarnings };
    }
    if (connections.some((c) => c.status === "error")) {
      return { status: "error", hasWarnings };
    }
    if (connections.some((c) => c.status === "connected")) {
      return { status: "connected", hasWarnings };
    }

    return { status: "idle", hasWarnings };
  }

  /**
   * Generic wrapper for client operations that handles 401 errors with token refresh
   * Only applies to SSE/HTTP connections, not stdio
   */
  private async withTokenRefresh<T>(
    serverName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Connection ${serverName} not found`);
    }

    const serverConfig = connection.config;
    if (!serverConfig || "command" in serverConfig) {
      // For stdio connections, just execute normally (no token refresh possible)
      return await operation();
    }

    try {
      // Try the operation first
      return await operation();
    } catch (error: unknown) {
      // If not a 401 error, rethrow
      if (!isAuthError(error)) {
        throw error;
      }

      // Check if user is signed in
      const isAuthed = await isAuthenticated();
      if (!isAuthed) {
        throw error;
      }

      const authConfig = loadAuthConfig();

      // Clear cached token since it's invalid
      this.apiKeyCache.delete(serverName);

      // Fetch OAuth token from backend
      const organizationSlug = authConfig?.organizationId;

      let token: string | null = null;
      try {
        const params = new URLSearchParams({
          url: serverConfig.url,
        });
        if (organizationSlug) {
          params.set("organizationSlug", organizationSlug);
        }
        if (serverConfig.sourceSlug) {
          params.set("slug", serverConfig.sourceSlug);
        }

        const response = await get<{
          configured: boolean;
          hasCredentials: boolean;
          accessToken?: string;
          expiresAt?: string;
          expired?: boolean;
        }>(`/ide/mcp-auth?${params.toString()}`);

        if (response.data.hasCredentials && response.data.accessToken) {
          token = response.data.accessToken;
          this.apiKeyCache.set(serverName, token);
        }
      } catch {
        logger.debug("Failed to fetch mcp oauth credentials");
      }

      if (!token) {
        throw error;
      }

      this.apiKeyCache.set(serverConfig.name, token);

      return await operation();
    }
  }

  /**
   * Run a tool by name
   */
  public async runTool(name: string, args: Record<string, any>) {
    for (const connection of this.connections.values()) {
      if (connection.status === "connected" && connection.client) {
        const tool = connection.tools.find((t) => t.name === name);
        if (tool) {
          const serverName = connection.config!.name;
          return await this.withTokenRefresh(serverName, async () => {
            const conn = this.connections.get(serverName);
            if (!conn?.client) {
              throw new Error(`Client for ${serverName} not available`);
            }
            return await conn.client.callTool({
              name,
              arguments: args,
            });
          });
        }
      }
    }
    throw new Error(`Tool ${name} not found`);
  }

  /**
   * Restart all servers
   */
  public async restartAllServers(): Promise<void> {
    if (!this.assistant) return;

    await this.shutdownConnections();
    await this.initialize(this.assistant);
  }

  /**
   * Restart a specific server
   */
  public async restartServer(serverName: string): Promise<void> {
    if (!this.assistant || !this.assistant.mcpServers) return;

    const serverConfig = this.assistant.mcpServers.find(
      (s, index) => s && (s.name || `server-${index}`) === serverName,
    );

    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found in configuration`);
    }

    const existingConnection = this.connections.get(serverName);
    if (existingConnection) {
      if (existingConnection.status === "connected") {
        await this.shutdownConnection(existingConnection);
      }
      this.connections.delete(serverName);
    }
    await this.connectServer(serverConfig);
  }

  private async connectServer(serverConfig: MCPServerConfig) {
    const connection: ServerConnection = {
      config: serverConfig,
      client: null,
      prompts: [],
      tools: [],
      status: "connecting",
      warnings: [],
    };
    const serverName = serverConfig.name;
    this.connections.set(serverName, connection);
    this.updateState();

    const vars = getTemplateVariables(JSON.stringify(serverConfig));
    const secretVars = vars.filter((v) => v.startsWith("secrets."));
    const unrendered = secretVars.map((v) => {
      return decodeFQSN(v.replace("secrets.", "")).secretName;
    });

    try {
      if (unrendered.length > 0) {
        const message = `${serverConfig.name} MCP Server has unresolved secrets: ${unrendered.join(", ")}
For personal use you can set the secret in the hub at https://hub.continue.dev/settings/secrets or pass it to the CLI environment.
Org-level secrets can only be used for MCP by Background Agents (https://docs.continue.dev/hub/agents/overview) when \"Include in Env\" is enabled for the secret.`;
        if (this.isHeadless) {
          throw new Error(message);
        } else {
          connection.warnings.push(message);
        }
      }

      const client = await this.getConnectedClient(serverConfig, connection);

      connection.client = client;
      connection.status = "connected";
      this.updateState();

      const capabilities = client.getServerCapabilities();

      if (capabilities?.prompts) {
        try {
          connection.prompts = await this.withTokenRefresh(
            serverName,
            async () => {
              const conn = this.connections.get(serverName);
              if (!conn?.client) {
                throw new Error(`Client for ${serverName} not available`);
              }
              return (await conn.client.listPrompts()).prompts;
            },
          );
        } catch (error) {
          const errorMessage = getErrorString(error);
          connection.warnings.push(`Failed to load prompts: ${errorMessage}`);
          logger.warn("Failed to load MCP prompts", {
            name: serverName,
            error: errorMessage,
          });
        }
      }

      if (capabilities?.tools) {
        try {
          connection.tools = await this.withTokenRefresh(
            serverName,
            async () => {
              const conn = this.connections.get(serverName);
              if (!conn?.client) {
                throw new Error(`Client for ${serverName} not available`);
              }
              return (await conn.client.listTools()).tools;
            },
          );
        } catch (error) {
          const errorMessage = getErrorString(error);
          connection.warnings.push(`Failed to load tools: ${errorMessage}`);
          logger.warn("Failed to load MCP tools", {
            name: serverName,
            error: errorMessage,
          });
        }
      }
    } catch (error) {
      const errorMessage = getErrorString(error);
      connection.status = "error";

      // Convert any warnings to error at time of connection failure
      if (connection.warnings.length > 0) {
        const stderrContent = connection.warnings.join("\n");
        connection.error = `${errorMessage}\n\nServer stderr:\n${stderrContent}`;
        connection.warnings = [];
      } else {
        connection.error = errorMessage;
      }

      logger.error("Failed to connect to MCP server", {
        name: serverName,
        error: connection.error,
      });
    }

    this.updateState();
  }

  /**
   * Stop a specific server
   */
  public async stopServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (connection) {
      await this.shutdownConnection(connection);
    }
  }

  /**
   * Shutdown all connections
   */
  public async shutdownConnections(): Promise<void> {
    const shutdownPromises = Array.from(this.connections.values()).map(
      (connection) => this.shutdownConnection(connection),
    );
    await Promise.all(shutdownPromises);
    this.updateState();
  }

  /**
   * Shutdown a single connection
   */
  private async shutdownConnection(
    connection: ServerConnection,
  ): Promise<void> {
    try {
      if (connection.client) {
        await connection.client.close();
      }
      connection.status = "idle";
      connection.warnings = [];
      connection.client = null;
      connection.tools = [];
      connection.prompts = [];
      connection.error = undefined;
      this.updateState();
    } catch (error) {
      const errorMessage = getErrorString(error);
      logger.warn("Error shutting down MCP connection", {
        name: connection.config?.name,
        error: errorMessage,
      });
    }
  }

  public async cleanup(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.removeAllListeners();
    await this.shutdownConnections();
  }

  /**
   * Construct transport based on server configuration and connect client
   */
  private async getConnectedClient(
    serverConfig: MCPServerConfig,
    connection: ServerConnection,
  ): Promise<Client> {
    const client = new Client(
      { name: "continue-cli-client", version: "1.0.0" },
      { capabilities: {} },
    );

    if ("command" in serverConfig) {
      // STDIO: no need to check type, just if command is present
      const transport = this.constructStdioTransport(serverConfig, connection);
      await client.connect(transport, {});
    } else {
      // SSE/HTTP: if type isn't explicit: try http and fall back to sse
      try {
        await this.withTokenRefresh(serverConfig.name, async () => {
          if (serverConfig.apiKey && !this.apiKeyCache.get(serverConfig.name)) {
            this.apiKeyCache.set(serverConfig.name, serverConfig.apiKey);
          }
          if (serverConfig.type === "sse") {
            const transport = this.constructSseTransport(serverConfig);
            await client.connect(transport, {});
          } else if (serverConfig.type === "streamable-http") {
            const transport = this.constructHttpTransport(serverConfig);
            await client.connect(transport, {});
          } else {
            try {
              const transport = this.constructHttpTransport(serverConfig);
              await client.connect(transport, {});
            } catch (e) {
              if (isAuthError(e)) {
                throw e;
              }
              const transport = this.constructSseTransport(serverConfig);
              await client.connect(transport, {});
            }
          }
        });
      } catch (error: unknown) {
        // If token refresh didn't work and it's a 401, fall back to mcp-remote
        if (isAuthError(error) && !this.isHeadless) {
          // Build mcp-remote args with Supabase-specific OAuth scopes if needed
          const mcpRemoteArgs = ["-y", "mcp-remote", serverConfig.url];

          // Detect Supabase MCP and add custom OAuth scopes
          if (serverConfig.url.includes("mcp.supabase.com")) {
            const supabaseScopes = [
              "organizations:read",
              "projects:read",
              "database:read",
              "analytics:read",
              "secrets:read",
              "edge_functions:read",
              "environment:read",
              "storage:read",
            ].join(" ");

            mcpRemoteArgs.push(
              "--static-oauth-client-metadata",
              JSON.stringify({ scope: supabaseScopes }),
            );
          }

          const transport = this.constructStdioTransport(
            {
              name: serverConfig.name,
              command: "npx",
              args: mcpRemoteArgs,
            },
            connection,
          );
          await client.connect(transport, {});
        } else {
          throw error;
        }
      }
    }

    return client;
  }

  private constructSseTransport(
    serverConfig: SseMcpServer,
  ): SSEClientTransport {
    const apiKey = this.apiKeyCache.get(serverConfig.name);
    // Merge apiKey into headers if provided
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
          }),
      },
      requestInit: { headers },
    });
  }
  private constructHttpTransport(
    serverConfig: HttpMcpServer,
  ): StreamableHTTPClientTransport {
    // Merge apiKey into headers if provided
    const apiKey = this.apiKeyCache.get(serverConfig.name);

    const headers = {
      ...serverConfig.requestOptions?.headers,
      ...(apiKey && {
        Authorization: `Bearer ${apiKey}`,
      }),
    };

    return new StreamableHTTPClientTransport(new URL(serverConfig.url), {
      requestInit: { headers },
    });
  }
  private constructStdioTransport(
    serverConfig: StdioMcpServer,
    connection: ServerConnection,
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
}
