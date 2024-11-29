import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { ContinueConfig, MCPOptions, SlashCommand } from "../..";
import { constructMcpSlashCommand } from "../../commands/slash/mcp";
import MCPContextProvider from "../providers/MCPContextProvider";

class MCPConnectionSingleton {
  private static instance: MCPConnectionSingleton;
  private client: Client;
  private transport: Transport;

  private constructor(private readonly options: MCPOptions) {
    this.transport = this.constructTransport(options);

    this.client = new Client(
      {
        name: "continue-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );
  }

  public static getInstance(options: MCPOptions): MCPConnectionSingleton {
    if (!MCPConnectionSingleton.instance) {
      MCPConnectionSingleton.instance = new MCPConnectionSingleton(options);
    }
    return MCPConnectionSingleton.instance;
  }

  private constructTransport(options: MCPOptions): Transport {
    switch (options.transport.type) {
      case "stdio":
        return new StdioClientTransport({
          command: options.transport.command,
          args: options.transport.args,
        });
      case "websocket":
        return new WebSocketClientTransport(new URL(options.transport.url));
      case "sse":
        return new SSEClientTransport(new URL(options.transport.url));
      default:
        throw new Error(
          `Unsupported transport type: ${(options.transport as any).type}`,
        );
    }
  }

  private isConnected: boolean = false;
  private connectPromise: Promise<void> | null = null;

  private async connectClient() {
    if (this.isConnected) {
      // Already connected
      return;
    }

    if (this.connectPromise) {
      // Connection is already in progress; wait for it to complete
      await this.connectPromise;
      return;
    }

    this.connectPromise = (async () => {
      await this.client.connect(this.transport);
      this.isConnected = true;
    })();

    try {
      await this.connectPromise;
    } catch (error) {
      // Handle connection error if needed
      throw error;
    } finally {
      // Reset the promise so future attempts can try again if necessary
      this.connectPromise = null;
    }
  }

  async modifyConfig(config: ContinueConfig): Promise<ContinueConfig> {
    try {
      await this.connectClient();
    } catch (error: any) {
      if (!error.message.startsWith("StdioClientTransport already started")) {
        console.error("Failed to connect client:", error);
        return config;
      }
    }

    // Resources <—> Context Provider
    const { resources } = await this.client.listResources();

    const submenuItems = resources.map((resource: any) => ({
      title: resource.name,
      description: resource.description,
      id: resource.uri,
    }));

    if (!config.contextProviders) {
      config.contextProviders = [];
    }

    config.contextProviders!.push(
      new MCPContextProvider({
        submenuItems,
        client: this.client,
      }),
    );

    // Tools <—> Tools
    // const { tools } = await this.client.listTools();
    // const continueTools: Tool = tools.map((tool) => ({

    // }))
    // if (!config.tools) {
    //     config.tools = []
    // }
    // config.tools!.push(...continueTools);

    // Prompts <—> Slash commands
    const { prompts } = await this.client.listPrompts();
    if (!config.slashCommands) {
      config.slashCommands = [];
    }

    const slashCommands: SlashCommand[] = prompts.map((prompt) => {
      return constructMcpSlashCommand(
        this.client,
        prompt.name,
        prompt.description,
        prompt.arguments?.map((a) => a.name),
      );
    });
    config.slashCommands!.push(...slashCommands);

    return config;
  }
}

export default MCPConnectionSingleton;
