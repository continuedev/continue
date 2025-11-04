import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  HttpMcpServer,
  SseMcpServer,
  StdioMcpServer,
} from "node_modules/@continuedev/config-yaml/dist/schemas/mcp/index.js";

import { getErrorString } from "../util/error.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  MCPConnectionInfo,
  MCPServerConfig,
  MCPServiceState,
  SERVICE_NAMES,
} from "./types.js";

function is401Error(error: unknown) {
  return (
    (error instanceof SseError && error.code === 401) ||
    (error instanceof Error && error.message.includes("401")) ||
    (error instanceof Error && error.message.includes("Unauthorized"))
  );
}

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
  private isHeadless = false;

  getDependencies(): string[] {
    return [SERVICE_NAMES.CONFIG];
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
    waitForConnections = false,
  ): Promise<MCPServiceState> {
    logger.debug("Initializing MCPService", {
      configName: assistant.name,
      serverCount: assistant.mcpServers?.length || 0,
    });

    // Store headless mode flag
    this.isHeadless = waitForConnections;

    await this.shutdownConnections();

    this.assistant = assistant;
    this.connections.clear();

    if (assistant.mcpServers?.length) {
      logger.debug("Starting MCP server connections", {
        serverCount: assistant.mcpServers.length,
      });
    }
    const connectionPromises = assistant.mcpServers?.map(async (config) => {
      if (config) {
        return await this.connectServer(config);
      }
    });

    const connectionInit = Promise.all(connectionPromises ?? []).then(
      (connections) => {
        logger.debug("MCP connections established", {
          connectionCount: connections.length,
        });
        this.updateState();
      },
    );
    if (waitForConnections) {
      await connectionInit;

      // In headless mode, throw error if any MCP server failed to connect
      const failedConnections = Array.from(this.connections.values()).filter(
        (c) => c.status === "error",
      );
      if (failedConnections.length > 0) {
        const errorMessages = failedConnections.map(
          (c) => `${c.config?.name}: ${c.error}`,
        );
        throw new Error(
          `MCP server(s) failed to load in headless mode:\n${errorMessages.join("\n")}`,
        );
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
   * Run a tool by name
   */
  public async runTool(name: string, args: Record<string, any>) {
    for (const connection of this.connections.values()) {
      if (connection.status === "connected" && connection.client) {
        const tool = connection.tools.find((t) => t.name === name);
        if (tool) {
          return await connection.client.callTool({
            name,
            arguments: args,
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

    logger.debug("Restarting all MCP servers");
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

    logger.debug("Restarting MCP server", { name: serverName });

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

    try {
      const client = await this.getConnectedClient(serverConfig);

      connection.client = client;
      connection.status = "connected";
      this.updateState();

      const capabilities = client.getServerCapabilities();
      logger.debug("MCP server capabilities", {
        name: serverName,
        hasPrompts: !!capabilities?.prompts,
        hasTools: !!capabilities?.tools,
      });

      if (capabilities?.prompts) {
        try {
          connection.prompts = (await client.listPrompts()).prompts;
          logger.debug("Loaded MCP prompts", {
            name: serverName,
            count: connection.prompts.length,
          });
        } catch (error) {
          const errorMessage = getErrorString(error);
          connection.warnings.push(`Failed to load prompts: ${errorMessage}`);
          logger.warn("Failed to load MCP prompts", {
            name: serverName,
            error: errorMessage,
          });

          // In headless mode, throw error on capability failures
          if (this.isHeadless) {
            throw new Error(
              `Failed to load prompts from MCP server ${serverName}: ${errorMessage}`,
            );
          }
        }
      }

      if (capabilities?.tools) {
        try {
          connection.tools = (await client.listTools()).tools;
          logger.debug("Loaded MCP tools", {
            name: serverName,
            count: connection.tools.length,
          });
        } catch (error) {
          const errorMessage = getErrorString(error);
          connection.warnings.push(`Failed to load tools: ${errorMessage}`);
          logger.warn("Failed to load MCP tools", {
            name: serverName,
            error: errorMessage,
          });

          // In headless mode, throw error on capability failures
          if (this.isHeadless) {
            throw new Error(
              `Failed to load tools from MCP server ${serverName}: ${errorMessage}`,
            );
          }
        }
      }

      logger.debug("MCP server connected successfully", { name: serverName });
    } catch (error) {
      const errorMessage = getErrorString(error);
      connection.status = "error";
      connection.error = errorMessage;
      logger.error("Failed to connect to MCP server", {
        name: serverName,
        error: errorMessage,
      });

      // In headless mode, re-throw the error to fail fast
      if (this.isHeadless) {
        throw error;
      }
    }

    this.updateState();
  }

  /**
   * Stop a specific server
   */
  public async stopServer(serverName: string): Promise<void> {
    logger.debug("Stopping MCP server", { name: serverName });

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
    logger.debug("Shutting down MCPService");
    await this.shutdownConnections();
  }

  /**
   * Construct transport based on server configuration and connect client
   */
  private async getConnectedClient(
    serverConfig: MCPServerConfig,
  ): Promise<Client> {
    const client = new Client(
      { name: "continue-cli-client", version: "1.0.0" },
      { capabilities: {} },
    );

    if ("command" in serverConfig) {
      // STDIO: no need to check type, just if command is present
      logger.debug("Connecting to MCP server", {
        name: serverConfig.name,
        command: serverConfig.command,
      });
      const transport = this.constructStdioTransport(serverConfig);
      await client.connect(transport, {});
    } else {
      // SSE/HTTP: if type isn't explicit: try http and fall back to sse
      logger.debug("Connecting to MCP server", {
        name: serverConfig.name,
        url: serverConfig.url,
      });

      try {
        if (serverConfig.type === "sse") {
          const transport = this.constructSseTransport(serverConfig);
          await client.connect(transport, {});
        } else if (serverConfig.type === "streamable-http") {
          const transport = this.constructHttpTransport(serverConfig);
          await client.connect(transport, {});
        }
      } catch (error: unknown) {
        // on authorization error, use "mcp-remote" with stdio transport to connect
        if (is401Error(error)) {
          const transport = this.constructStdioTransport({
            name: serverConfig.name,
            command: "npx",
            args: ["-y", "mcp-remote", serverConfig.url],
          });
          await client.connect(transport, {});
        } else {
          throw error;
        }
      }

      if (typeof serverConfig.type === "undefined") {
        try {
          const transport = this.constructHttpTransport(serverConfig);
          await client.connect(transport, {});
        } catch {
          logger.debug(
            "MCP Connection: http connection failed, falling back to sse connection",
            {
              name: serverConfig.name,
            },
          );
          try {
            const transport = this.constructSseTransport(serverConfig);
            await client.connect(transport, {});
          } catch (e) {
            throw new Error(
              `MCP config with URL and no type specified failed both SSE and HTTP connection: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      } else if (
        !["streamable-http", "sse", "stdio"].includes(serverConfig.type)
      ) {
        throw new Error(`Unsupported transport type: ${serverConfig.type}`);
      }
    }

    return client;
  }

  private constructSseTransport(
    serverConfig: SseMcpServer,
  ): SSEClientTransport {
    // Merge apiKey into headers if provided
    const headers = {
      ...serverConfig.requestOptions?.headers,
      ...(serverConfig.apiKey && {
        Authorization: `Bearer ${serverConfig.apiKey}`,
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
    const headers = {
      ...serverConfig.requestOptions?.headers,
      ...(serverConfig.apiKey && {
        Authorization: `Bearer ${serverConfig.apiKey}`,
      }),
    };

    return new StreamableHTTPClientTransport(new URL(serverConfig.url), {
      requestInit: { headers },
    });
  }
  private constructStdioTransport(
    serverConfig: StdioMcpServer,
  ): StdioClientTransport {
    const env: Record<string, string> = serverConfig.env || {};
    if (process.env.PATH !== undefined) {
      env.PATH = process.env.PATH;
    }

    return new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args || [],
      env,
      cwd: serverConfig.cwd,
      stderr: "ignore",
    });
  }
}
