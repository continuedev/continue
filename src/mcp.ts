import { type AssistantConfig } from "@continuedev/sdk";
import {logger} from "./util/logger.js";
import { MCPServiceState } from "./services/types.js";
import { MCPConnection, MCPServerStatus } from "./MCPConnection.js";


export interface MCPConnectionInfo {
  name: string;
  command: string;
  status: MCPServerStatus;
  toolCount: number;
  promptCount: number;
  error?: Error;
  warnings: string[];
}


export class MCPService {
  private connections: Map<string, MCPConnection> = new Map();
  private currentState: MCPServiceState;
  private assistant: AssistantConfig | null = null;
  private isShuttingDown = false;

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
    logger.debug("Initializing MCPService");

    this.assistant = assistant;
    this.connections.clear();

    // Service initialization should not block on server connections
    if (assistant.mcpServers?.length) {
      logger.debug("Starting MCP server connections", {
        serverCount: assistant.mcpServers.length,
      });

      // Initialize all servers simultaneously without blocking
      const connectionPromises = assistant.mcpServers.map(
        async (serverConfig, index) => {
          if (!serverConfig) return;

          const serverName = serverConfig.name || `server-${index}`;
          try {
            const connection = await MCPConnection.create(
              serverConfig,
              serverName
            );
            this.connections.set(serverName, connection);
            logger.debug("MCP server connected", {
              name: serverName,
              command: serverConfig.command,
            });
          } catch (error: any) {
            logger.error("MCP server connection failed", {
              name: serverName,
              error: error.message,
            });
            // Create a failed connection entry
            const failedConnection = new MCPConnection(
              null,
              serverConfig.command || "unknown",
              serverName
            );
            failedConnection.status = "error";
            failedConnection.error = error;
            this.connections.set(serverName, failedConnection);
          }
        }
      );

      // Don't await - let connections happen in background
      Promise.all(connectionPromises)
        .then(() => {
          this.updateState();
          logger.debug("All MCP server connections completed");
        })
        .catch(() => {
          // Individual errors are already handled above
          this.updateState();
        });
    }

    // Return immediately with current state
    this.updateState();
    return this.currentState;
  }

  /**
   * Update internal state based on current connections
   */
  private updateState(): void {
    const connections = Array.from(this.connections.values());
    const connectedConnections = connections.filter(
      (c) => c.status === "connected"
    );

    this.currentState = {
      mcpService: this,
      connections: this.getConnectionInfo(),
      toolCount: connectedConnections.reduce(
        (sum, c) => sum + c.tools.length,
        0
      ),
      promptCount: connectedConnections.reduce(
        (sum, c) => sum + c.prompts.length,
        0
      ),
      isReady: true,
    };
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
    await this.shutdownConnections();

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
      name: connection.name,
      command: connection.command,
      status: connection.status,
      toolCount: connection.tools.length,
      promptCount: connection.prompts.length,
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
    toolCount: number;
    promptCount: number;
    connectionCount: number;
  } {
    return {
      toolCount: this.currentState.toolCount,
      promptCount: this.currentState.promptCount,
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
      (s, index) => s && (s.name || `server-${index}`) === serverName
    );

    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found in configuration`);
    }

    logger.debug("Restarting MCP server", { name: serverName });

    // Stop existing connection
    const existingConnection = this.connections.get(serverName);
    if (existingConnection) {
      await this.shutdownConnection(existingConnection);
    }

    // Start new connection
    try {
      const connection = await MCPConnection.create(serverConfig, serverName);
      this.connections.set(serverName, connection);
      logger.debug("MCP server restarted successfully", { name: serverName });
    } catch (error: any) {
      logger.error("Failed to restart MCP server", {
        name: serverName,
        error: error.message,
      });
      const failedConnection = new MCPConnection(
        null,
        serverConfig.command || "unknown",
        serverName
      );
      failedConnection.status = "error";
      failedConnection.error = error;
      this.connections.set(serverName, failedConnection);
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
      this.connections.delete(serverName);
    }

    this.updateState();
  }

  /**
   * Get a specific server connection info
   */
  public getServerInfo(serverName: string): MCPConnectionInfo | null {
    const connection = this.connections.get(serverName);
    if (!connection) return null;

    return {
      name: connection.name,
      command: connection.command,
      status: connection.status,
      toolCount: connection.tools.length,
      promptCount: connection.prompts.length,
      error: connection.error,
      warnings: connection.warnings,
    };
  }

  /**
   * Shutdown all connections
   */
  private async shutdownConnections(): Promise<void> {
    const shutdownPromises = Array.from(this.connections.values()).map(
      (connection) => this.shutdownConnection(connection)
    );

    await Promise.all(shutdownPromises);
    this.connections.clear();
  }

  /**
   * Shutdown a single connection
   */
  private async shutdownConnection(connection: MCPConnection): Promise<void> {
    try {
      if (connection.client) {
        await connection.client.close();
      }
    } catch (error: any) {
      logger.warn("Error shutting down MCP connection", {
        name: connection.name,
        error: error.message,
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
  }
}

