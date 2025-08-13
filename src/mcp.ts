import { type AssistantConfig } from "@continuedev/sdk";

import { MCPConnection } from "./MCPConnection.js";
import { logger } from "./util/logger.js";

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
      logger.debug("Creating MCP connections", {
        serverCount: assistant.mcpServers.length,
      });
      const connectionPromises = assistant.mcpServers.map((server) =>
        MCPConnection.create(server),
      );
      const connections = (await Promise.all(connectionPromises)).filter(
        (item) => item !== undefined,
      );
      service.connections.push(...connections);
      logger.debug("MCP connections established", {
        connectionCount: connections.length,
      });
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
