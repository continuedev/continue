import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class MCPService {
  private readonly connections: MCPConnection[] = [];
  private static instance: MCPService | null = null;

  private constructor(private readonly assistant: AssistantConfig) {
    this.assistant = assistant;
  }

  public static async create(assistant: AssistantConfig) {
    // If instance already exists, return it
    if (MCPService.instance) {
      return MCPService.instance;
    }

    // Otherwise create a new instance
    const service = new MCPService(assistant);

    if (assistant.mcpServers?.length) {
      const connectionPromises = assistant.mcpServers.map((server) =>
        MCPConnection.create(server)
      );
      const connections = await Promise.all(connectionPromises);
      service.connections.push(...connections);
    }

    // Store the instance and return it
    MCPService.instance = service;
    return service;
  }

  // Method to get the singleton instance (returns null if not initialized)
  public static getInstance(): MCPService | null {
    return MCPService.instance;
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

  private constructor(public readonly client: Client) {}

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
    const connection = new MCPConnection(client);
    await client.connect(transport);
    const capabilities = client.getServerCapabilities();

    if (capabilities?.prompts) {
      connection.prompts = (await client.listPrompts()).prompts;
    }

    if (capabilities?.tools) {
      connection.tools = (await client.listTools()).tools;
    }

    return connection;
  }
}
