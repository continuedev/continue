import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { ContinueConfig, MCPOptions, SlashCommand, Tool } from "../..";
import { constructMcpSlashCommand } from "../../commands/slash/mcp";
import MCPContextProvider from "../providers/MCPContextProvider";

class MCPConnectionSingleton {
  private static instance: MCPConnectionSingleton;
  public client: Client;
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

  public static getExistingInstance(): MCPConnectionSingleton | null {
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

  async checkClientAttribute(func: () => Promise<any>): Promise<any> {
    try {
      const result = await func();
      return result;
    } catch (e) {
      return null;
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
    const rawResources = await this.checkClientAttribute(() => this.client.listResources());
    if (rawResources && rawResources.resources) {
      const submenuItems = rawResources.resources.map((resource: any) => ({
        title: resource.name,
        description: resource.description,
        id: resource.uri,
      }));
  
      if (!config.contextProviders) {
        config.contextProviders = [];
      }
  
      config.contextProviders.push(
        new MCPContextProvider({
          submenuItems,
          client: this.client,
        }),
      );
    } else {
      console.warn("Failed to retrieve resources or resources are empty");
    }
  
    // Tools <—> Tools
    const rawTools = await this.checkClientAttribute(() => this.client.listTools());
    if (rawTools && rawTools.tools) {
      const continueTools: Tool[] = rawTools.tools.map((tool: any) => ({
        displayTitle: tool.name,
        function: {
          description: tool.description,
          name: tool.name,
          parameters: tool.inputSchema,
        },
        readonly: false,
        type: "function",
        wouldLikeTo: `use the ${tool.name} tool`,
        uri: `mcp://${tool.name}`,
      }));
  
      config.tools = [...config.tools, ...continueTools];
    } else {
      console.warn("Failed to retrieve tools or tools are empty");
    }
  
    // Prompts <—> Slash commands
    const rawPrompts = await this.checkClientAttribute(() => this.client.listPrompts());
    if (rawPrompts && rawPrompts.prompts) {
      if (!config.slashCommands) {
        config.slashCommands = [];
      }
  
      const slashCommands: SlashCommand[] = rawPrompts.prompts.map((prompt: any) => 
        constructMcpSlashCommand(
          this.client,
          prompt.name,
          prompt.description,
          prompt.arguments?.map((a: any) => a.name),
        )
      );
  
      config.slashCommands.push(...slashCommands);
    } else {
      console.warn("Failed to retrieve prompts or prompts are empty");
    }
  
    return config;
  }
}

export default MCPConnectionSingleton;
