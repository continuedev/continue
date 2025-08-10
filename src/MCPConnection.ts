import { type AssistantConfig } from "@continuedev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { logger } from "./util/logger.js";

export type MCPServerStatus = "idle" | "connecting" | "connected" | "error";

export class MCPConnection {
  public prompts: Awaited<ReturnType<Client["listPrompts"]>>["prompts"] = [];
  public tools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];
  public status: MCPServerStatus = "idle";
  public error?: Error;
  public warnings: string[] = [];
  public readonly command: string;
  public readonly name: string;

  constructor(
    public readonly client: Client | null,
    command: string,
    name: string
  ) {
    this.command = command;
    this.name = name;
  }

  public static async create(
    config: NonNullable<AssistantConfig["mcpServers"]>[number],
    name: string
  ): Promise<MCPConnection> {
    if (!config) {
      throw new Error("MCP server config is null");
    }

    const connection = new MCPConnection(
      null,
      config.command || "unknown",
      name
    );
    connection.status = "connecting";

    try {
      const client = new Client(
        {
          name: "continue-cli-client",
          version: "1.0.0",
        },
        { capabilities: {} }
      );

      // Construct transport
      const env: Record<string, string> = config.env || {};
      if (process.env.PATH !== undefined) {
        env.PATH = process.env.PATH;
      }

      if (!config.command) {
        throw new Error("MCP server command is not specified");
      }

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
      });

      // Connect
      logger.debug("Connecting to MCP server", {
        name,
        command: config.command,
      });
      await client.connect(transport, {});

      // Update connection with successful client
      (connection as any).client = client;
      connection.status = "connected";

      const capabilities = client.getServerCapabilities();
      logger.debug("MCP server capabilities", {
        name,
        hasPrompts: !!capabilities?.prompts,
        hasTools: !!capabilities?.tools,
      });

      // Load prompts
      if (capabilities?.prompts) {
        try {
          connection.prompts = (await client.listPrompts()).prompts;
          logger.debug("Loaded MCP prompts", {
            name,
            count: connection.prompts.length,
          });
        } catch (error: any) {
          connection.warnings.push(`Failed to load prompts: ${error.message}`);
          logger.warn("Failed to load MCP prompts", {
            name,
            error: error.message,
          });
        }
      }

      // Load tools
      if (capabilities?.tools) {
        try {
          connection.tools = (await client.listTools()).tools;
          logger.debug("Loaded MCP tools", {
            name,
            count: connection.tools.length,
          });
        } catch (error: any) {
          connection.warnings.push(`Failed to load tools: ${error.message}`);
          logger.warn("Failed to load MCP tools", {
            name,
            error: error.message,
          });
        }
      }

      return connection;
    } catch (error: any) {
      connection.status = "error";
      connection.error = error;
      logger.error("Failed to connect to MCP server", {
        name,
        error: error.message,
      });
      throw error;
    }
  }
}

