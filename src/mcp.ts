import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { serviceContainer } from "./services/ServiceContainer.js";
import { MCPServiceState, SERVICE_NAMES } from "./services/types.js";
import { getErrorString } from "./util/error.js";
import { logger } from "./util/logger.js";

export type MCPServerStatus = "idle" | "connecting" | "connected" | "error";

type MCPServerConfig = NonNullable<
  NonNullable<AssistantConfig["mcpServers"]>[number]
>;

interface ServerConnection {
  config: MCPServerConfig;
  client: Client | null;
  prompts: Awaited<ReturnType<Client["listPrompts"]>>["prompts"];
  tools: Awaited<ReturnType<Client["listTools"]>>["tools"];
  status: MCPServerStatus;
  error?: string;
  warnings: string[];
}

export interface MCPConnectionInfo {
  config: MCPServerConfig;
  status: MCPServerStatus;
  toolNames: string[];
  promptNames: string[];
  error?: string;
  warnings: string[];
}

export class MCPService {
  private connections: Map<string, ServerConnection> = new Map();
  private currentState: MCPServiceState;
  private assistant: AssistantConfig | null = null;
  private isShuttingDown = false;
  private initVersion = 0;

  constructor() {
    this.currentState = {
      mcpService: null,
      connections: [],
      toolCount: 0,
      promptCount: 0,
      isReady: false,
    };

    // Register shutdown handler
    process.on("exit", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
  }

  /**
   * Initialize the MCP service
   */
  async initialize(assistant: AssistantConfig): Promise<MCPServiceState> {
    logger.debug("Initializing MCPService", {
      configName: assistant.name,
      serverCount: assistant.mcpServers?.length || 0,
    });

    const version = ++this.initVersion;

    await this.shutdownConnections();

    this.assistant = assistant;
    this.connections.clear();

    if (assistant.mcpServers?.length) {
      logger.debug("Starting MCP server connections", {
        serverCount: assistant.mcpServers.length,
      });

      const connectionPromises = assistant.mcpServers.map(
        async (serverConfig, index) => {
          if (!serverConfig) return;
          const serverName = serverConfig.name || `server-${index}`;
          // Create placeholder connection with connecting state
          const connection: ServerConnection = {
            config: serverConfig,
            client: null,
            prompts: [],
            tools: [],
            status: "connecting",
            warnings: [],
          };
          this.connections.set(serverName, connection);
          this.updateState();

          try {
            if (serverConfig.type && serverConfig.type !== "stdio") {
              throw new Error(
                `${serverConfig.type} MCP servers are not yet supported in the Continue CLI`,
              );
            }
            if (!serverConfig.command) {
              throw new Error("MCP server command is not specified");
            }

            const client = new Client(
              { name: "continue-cli-client", version: "1.0.0" },
              { capabilities: {} },
            );

            const env: Record<string, string> = serverConfig.env || {};
            if (process.env.PATH !== undefined) {
              env.PATH = process.env.PATH;
            }

            const transport = new StdioClientTransport({
              command: serverConfig.command,
              args: serverConfig.args,
              env,
              stderr: "ignore",
            });

            logger.debug("Connecting to MCP server", {
              name: serverName,
              command: serverConfig.command,
            });

            await client.connect(transport, {});

            // Ignore results from stale initializations
            if (version !== this.initVersion) {
              try {
                await client.close();
              } catch {}
              return;
            }

            connection.client = client;
            connection.status = "connected";

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
                connection.warnings.push(
                  `Failed to load prompts: ${errorMessage}`,
                );
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
                connection.warnings.push(
                  `Failed to load tools: ${errorMessage}`,
                );
                logger.warn("Failed to load MCP tools", {
                  name: serverName,
                  error: errorMessage,
                });
              }
            }

            logger.debug("MCP server connected", {
              name: serverName,
              command: serverConfig.command,
            });
            this.updateState();
          } catch (error) {
            if (version !== this.initVersion) {
              return;
            }
            const errorMessage = getErrorString(error);
            connection.status = "error";
            connection.error = errorMessage;
            logger.error("MCP server connection failed", {
              name: serverName,
              error: errorMessage,
            });
            this.updateState();
          }
        },
      );

      Promise.all(connectionPromises)
        .then(() => {
          if (version === this.initVersion) {
            this.updateState();
            logger.debug("All MCP server connections completed");
          }
        })
        .catch(() => {
          if (version === this.initVersion) {
            this.updateState();
          }
        });
    }

    this.updateState();
    return this.currentState;
  }

  /**
   * Update internal state based on current connections
   */
  private updateState(): void {
    const connections = Array.from(this.connections.values());
    const connectedConnections = connections.filter(
      (c) => c.status === "connected",
    );

    this.currentState = {
      mcpService: this,
      connections: this.getConnectionInfo(),
      toolCount: connectedConnections.reduce(
        (sum, c) => sum + c.tools.length,
        0,
      ),
      promptCount: connectedConnections.reduce(
        (sum, c) => sum + c.prompts.length,
        0,
      ),
      isReady: true,
    };

    // Propagate state changes to the service container so the UI updates
    try {
      serviceContainer.set(SERVICE_NAMES.MCP, this.currentState);
    } catch {
      // In early boot, container may not yet be registered; ignore
    }
  }

  /**
   * Get current MCP service state
   */
  getState(): MCPServiceState {
    return { ...this.currentState };
  }

  /**
   * Update the MCP service with a new assistant config
   */
  async update(assistant: AssistantConfig): Promise<MCPServiceState> {
    logger.debug("Updating MCPService");

    // Shutdown existing connections
    return await this.initialize(assistant);
  }

  /**
   * Check if the MCP service is ready
   */
  isReady(): boolean {
    return this.currentState.isReady;
  }

  /**
   * Get connection information for display
   */
  getConnectionInfo(): MCPConnectionInfo[] {
    return Array.from(this.connections.values()).map((connection) => ({
      config: connection.config,
      status: connection.status,
      toolNames: connection.tools.map((tool) => tool.name),
      promptNames: connection.prompts.map((prompt) => prompt.name),
      error: connection.error,
      warnings: connection.warnings,
    }));
  }

  /**
   * Get overall status for UI indicator
   */
  getOverallStatus(): {
    status: "idle" | "connecting" | "connected" | "error";
    hasWarnings: boolean;
  } {
    const connections = Array.from(this.connections.values());

    if (connections.length === 0) {
      return { status: "idle", hasWarnings: false };
    }

    const hasConnecting = connections.some((c) => c.status === "connecting");
    const hasError = connections.some((c) => c.status === "error");
    const hasConnected = connections.some((c) => c.status === "connected");
    const hasWarnings = connections.some((c) => c.warnings.length > 0);

    if (hasConnecting) {
      return { status: "connecting", hasWarnings };
    }
    if (hasError) {
      return { status: "error", hasWarnings };
    }
    if (hasConnected) {
      return { status: "connected", hasWarnings };
    }

    return { status: "idle", hasWarnings };
  }

  /**
   * Get MCP service information for display
   */
  getMCPInfo(): {
    toolNames: string[];
    promptNames: string[];
    connectionCount: number;
  } {
    const connectedConnections = Array.from(this.connections.values()).filter(
      (c) => c.status === "connected",
    );

    return {
      toolNames: connectedConnections.flatMap((connection) =>
        connection.tools.map((tool) => tool.name),
      ),
      promptNames: connectedConnections.flatMap((connection) =>
        connection.prompts.map((prompt) => prompt.name),
      ),
      connectionCount: this.connections.size,
    };
  }

  /**
   * Get all prompts from connected servers only
   */
  public getPrompts() {
    return Array.from(this.connections.values())
      .filter((connection) => connection.status === "connected")
      .flatMap((connection) => connection.prompts);
  }

  /**
   * Get all tools from connected servers only
   */
  public getTools() {
    return Array.from(this.connections.values())
      .filter((connection) => connection.status === "connected")
      .flatMap((connection) => connection.tools);
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
    this.updateState();
  }

  /**
   * Stop all servers
   */
  public async stopAllServers(): Promise<void> {
    logger.debug("Stopping all MCP servers");
    await this.shutdownConnections();
    this.updateState();
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

    const connection: ServerConnection = {
      config: serverConfig,
      client: null,
      prompts: [],
      tools: [],
      status: "connecting",
      warnings: [],
    };
    this.connections.set(serverName, connection);
    this.updateState();

    try {
      if (!serverConfig.command) {
        throw new Error("MCP server command is not specified");
      }

      const client = new Client(
        { name: "continue-cli-client", version: "1.0.0" },
        { capabilities: {} },
      );

      const env: Record<string, string> = serverConfig.env || {};
      if (process.env.PATH !== undefined) {
        env.PATH = process.env.PATH;
      }

      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env,
        stderr: "ignore",
      });

      logger.debug("Connecting to MCP server", {
        name: serverName,
        command: serverConfig.command,
      });

      await client.connect(transport, {});

      connection.client = client;
      connection.status = "connected";

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
   * Get a specific server connection info
   */
  public getServerInfo(serverName: string): MCPConnectionInfo | null {
    const connection = this.connections.get(serverName);
    if (!connection) return null;

    return {
      config: connection.config,
      status: connection.status,
      toolNames: connection.tools.map((tool) => tool.name),
      promptNames: connection.prompts.map((prompt) => prompt.name),
      error: connection.error,
      warnings: connection.warnings,
    };
  }

  /**
   * Shutdown all connections
   */
  private async shutdownConnections(): Promise<void> {
    const shutdownPromises = Array.from(this.connections.values()).map(
      (connection) => this.shutdownConnection(connection),
    );

    await Promise.all(shutdownPromises);
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

  /**
   * Shutdown the entire service
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.debug("Shutting down MCPService");

    await this.shutdownConnections();

    this.currentState = {
      mcpService: null,
      connections: [],
      toolCount: 0,
      promptCount: 0,
      isReady: false,
    };

    this.updateState();
  }
}
