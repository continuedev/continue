import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import logger from "./util/logger.js";
import { MCPServiceState } from "./services/types.js";

export interface MCPConnectionInfo {
  command: string;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  promptCount: number;
  error?: Error;
}

export class MCPService {
  private connections: MCPConnection[] = [];
  private currentState: MCPServiceState;
  private assistant: AssistantConfig | null = null;

  constructor() {
    this.currentState = {
      mcpService: null,
      connections: [],
      toolCount: 0,
      promptCount: 0,
      isReady: false
    };
  }

  /**
   * Initialize the MCP service
   */
  async initialize(assistant: AssistantConfig): Promise<MCPServiceState> {
    logger.debug('Initializing MCPService');
    
    try {
      this.assistant = assistant;
      this.connections = [];
      
      if (assistant.mcpServers?.length) {
        logger.debug('Creating MCP connections', { serverCount: assistant.mcpServers.length });
        const connectionPromises = assistant.mcpServers.map((server) =>
          MCPConnection.create(server)
        );
        const connections = await Promise.all(connectionPromises);
        this.connections.push(...connections);
        logger.debug('MCP connections established', { connectionCount: connections.length });
      }

      this.currentState = {
        mcpService: this,
        connections: this.getConnectionInfo(),
        toolCount: this.getTools().length,
        promptCount: this.getPrompts().length,
        isReady: true
      };

      logger.debug('MCPService initialized successfully', {
        toolCount: this.currentState.toolCount,
        promptCount: this.currentState.promptCount,
        connectionCount: this.connections.length
      });

      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to initialize MCPService:', error);
      this.currentState = {
        mcpService: null,
        connections: [],
        toolCount: 0,
        promptCount: 0,
        isReady: false,
        error
      };
      throw error;
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
    logger.debug('Updating MCPService');
    
    try {
      // Close existing connections
      this.connections = [];
      
      return await this.initialize(assistant);
    } catch (error: any) {
      logger.error('Failed to update MCPService:', error);
      throw error;
    }
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
    return this.connections.map(connection => ({
      command: connection.command,
      status: 'connected',
      toolCount: connection.tools.length,
      promptCount: connection.prompts.length
    }));
  }

  /**
   * Get MCP service information for display
   */
  getMCPInfo(): { toolCount: number; promptCount: number; connectionCount: number } {
    return {
      toolCount: this.currentState.toolCount,
      promptCount: this.currentState.promptCount,
      connectionCount: this.connections.length
    };
  }

  public getPrompts() {
    return this.connections.flatMap((connection) => connection.prompts);
  }

  public getTools() {
    return this.connections.flatMap((connection) => connection.tools);
  }

  public async runTool(name: string, args: Record<string, any>) {
    for (const connection of this.connections) {
      const tool = connection.tools.find((t) => t.name === name);
      if (tool) {
        return await connection.client.callTool({
          name,
          arguments: args,
        });
      }
    }
    throw new Error(`Tool ${name} not found`);
  }
}

export class MCPConnection {
  prompts: Awaited<ReturnType<Client["listPrompts"]>>["prompts"] = [];
  tools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];
  public readonly command: string;

  private constructor(public readonly client: Client, command: string) {
    this.command = command;
  }

  public static async create(
    config: NonNullable<AssistantConfig["mcpServers"]>[number]
  ) {
    const client = new Client(
      {
        name: "continue-cli-client",
        version: "1.0.0",
      },
      { capabilities: {} }
    );

    // Construct transport
    const env: Record<string, string> = config?.env || {};
    if (process.env.PATH !== undefined) {
      env.PATH = process.env.PATH;
    }

    if (!config?.command) {
      throw new Error("MCP server command is not specified");
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config?.args,
      env,
    });

    // Connect and get all prompts and tools
    const connection = new MCPConnection(client, config.command);
    logger.debug('Connecting to MCP server', { command: config.command });
    await client.connect(transport);
    const capabilities = client.getServerCapabilities();
    logger.debug('MCP server capabilities', { hasPrompts: !!capabilities?.prompts, hasTools: !!capabilities?.tools });

    if (capabilities?.prompts) {
      connection.prompts = (await client.listPrompts()).prompts;
    }

    if (capabilities?.tools) {
      connection.tools = (await client.listTools()).tools;
    }

    return connection;
  }
}
