import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

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

  getDependencies(): string[] {
    return [SERVICE_NAMES.AUTH, SERVICE_NAMES.API_CLIENT, SERVICE_NAMES.CONFIG];
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
      const client = new Client(
        { name: "continue-cli-client", version: "1.0.0" },
        { capabilities: {} },
      );

      const transport = await this.constructTransport(serverConfig);

      logger.debug("Connecting to MCP server", {
        name: serverName,
        command: serverConfig.command,
      });

      await client.connect(transport, {});

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
        }
      }

      logger.debug("MCP server restarted successfully", { name: serverName });
    } catch (error) {
      const errorMessage = getErrorString(error);
      connection.status = "error";
      connection.error = errorMessage;
      logger.error("Failed to restart MCP server", {
        name: serverName,
        error: errorMessage,
      });
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
   * Construct transport based on server configuration
   */
  private async constructTransport(
    serverConfig: MCPServerConfig,
  ): Promise<Transport> {
    const transportType = serverConfig.type || "stdio";

    switch (transportType) {
      case "stdio":
        if (!serverConfig.command) {
          throw new Error(
            "MCP server command is not specified for stdio transport",
          );
        }

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

      case "sse":
        if (!serverConfig.url) {
          throw new Error("MCP server URL is not specified for SSE transport");
        }
        return new SSEClientTransport(new URL(serverConfig.url), {
          eventSourceInit: {
            fetch: (input, init) =>
              fetch(input, {
                ...init,
                headers: {
                  ...init?.headers,
                  ...(serverConfig.requestOptions?.headers as
                    | Record<string, string>
                    | undefined),
                },
              }),
          },
          requestInit: { headers: serverConfig.requestOptions?.headers },
        });

      case "streamable-http":
        if (!serverConfig.url) {
          throw new Error(
            "MCP server URL is not specified for streamable-http transport",
          );
        }
        return new StreamableHTTPClientTransport(new URL(serverConfig.url), {
          requestInit: { headers: serverConfig.requestOptions?.headers },
        });

      default:
        throw new Error(`Unsupported transport type: ${transportType}`);
    }
  }
}
