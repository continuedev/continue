import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { ConfigValidationError } from "@continuedev/config-yaml";
import { ContinueConfig, MCPOptions, SlashCommand, Tool } from "../..";
import { constructMcpSlashCommand } from "../../commands/slash/mcp";
import { encodeMCPToolUri } from "../../tools/callTool";
import MCPContextProvider from "../providers/MCPContextProvider";

export class MCPManagerSingleton {
  private static instance: MCPManagerSingleton;

  private connections: Map<string, MCPConnection> = new Map();

  private constructor() {}

  public static getInstance(): MCPManagerSingleton {
    if (!MCPManagerSingleton.instance) {
      MCPManagerSingleton.instance = new MCPManagerSingleton();
    }
    return MCPManagerSingleton.instance;
  }

  createConnection(id: string, options: MCPOptions): MCPConnection | undefined {
    if (!this.connections.has(id)) {
      const connection = new MCPConnection(options);
      this.connections.set(id, connection);
      return connection;
    } else {
      return this.connections.get(id);
    }
  }

  getConnection(id: string) {
    return this.connections.get(id);
  }

  async removeConnection(id: string) {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.client.close();
    }

    this.connections.delete(id);
  }
}

class MCPConnection {
  public client: Client;
  private transport: Transport;

  constructor(private readonly options: MCPOptions) {
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

  private constructTransport(options: MCPOptions): Transport {
    switch (options.transport.type) {
      case "stdio":
        return new StdioClientTransport({
          command: options.transport.command,
          args: options.transport.args,
          env: options.transport.env,
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
    } finally {
      // Reset the promise so future attempts can try again if necessary
      this.connectPromise = null;
    }
  }

  async modifyConfig(
    config: ContinueConfig,
    mcpId: string,
    signal: AbortSignal,
  ): Promise<ConfigValidationError | undefined> {
    try {
      await Promise.race([
        this.connectClient(),
        new Promise((_, reject) => {
          signal.addEventListener("abort", () =>
            reject(new Error("Connection aborted")),
          );
        }),
      ]);
    } catch (error: any) {
      if (signal.aborted) {
        throw new Error("Operation aborted");
      }
      if (!error.message.startsWith("StdioClientTransport already started")) {
        return {
          fatal: false,
          message: `Failed to connect to MCP: ${error.message}`,
        };
      }
    }

    const capabilities = this.client.getServerCapabilities();

    // Resources <—> Context Provider
    if (capabilities?.resources) {
      const { resources } = await this.client.listResources({}, { signal });
      const submenuItems = resources.map((resource: any) => ({
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
        }),
      );
    }

    // Tools <—> Tools
    if (capabilities?.tools) {
      const { tools } = await this.client.listTools({}, { signal });
      const continueTools: Tool[] = tools.map((tool: any) => ({
        displayTitle: tool.name,
        function: {
          description: tool.description,
          name: tool.name,
          parameters: tool.inputSchema,
        },
        readonly: false,
        type: "function",
        wouldLikeTo: `use the ${tool.name} tool`,
        uri: encodeMCPToolUri(mcpId, tool.name),
      }));

      config.tools = [...config.tools, ...continueTools];
    }

    // Prompts <—> Slash commands
    if (capabilities?.prompts) {
      const { prompts } = await this.client.listPrompts({}, { signal });
      if (!config.slashCommands) {
        config.slashCommands = [];
      }

      const slashCommands: SlashCommand[] = prompts.map((prompt: any) =>
        constructMcpSlashCommand(
          this.client,
          prompt.name,
          prompt.description,
          prompt.arguments?.map((a: any) => a.name),
        ),
      );

      config.slashCommands.push(...slashCommands);
    }
  }
}

export default MCPConnection;
