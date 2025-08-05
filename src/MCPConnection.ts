import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { logger } from "./util/logger.js";

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