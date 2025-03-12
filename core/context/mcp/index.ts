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
import { createMCPTemplateContextProviderClass } from "../providers/MCPTemplateContextProvider";

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
        const env: Record<string, string> = options.transport.env || {};
        if (process.env.PATH !== undefined) {
          env.PATH = process.env.PATH;
        }
        return new StdioClientTransport({
          command: options.transport.command,
          args: options.transport.args,
          env,
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
    name: string,
    faviconUrl: string | undefined,
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
        icon: faviconUrl,
      }));

      if (!config.contextProviders) {
        config.contextProviders = [];
      }

      config.contextProviders.push(
        new MCPContextProvider({
          submenuItems,
          mcpId,
        }),
      );

      const templates = await this.client.listResourceTemplates({}, { signal });
      const templateContextProviders = templates.resourceTemplates.map(
        (resource: any) => {
          const matches = resource.uriTemplate.matchAll(
            /{([^}]+)}/g,
          ) as IterableIterator<RegExpMatchArray>;
          const params = Array.from(matches, (m) => m[1]);
          if (params.length === 0) {
            throw new Error(
              `No parameters found in resource template ${resource.name}`,
            );
          }

          if (params.length > 1) {
            throw new Error(
              `Cant use resource template ${resource.name} with more than one parameter. This is a limitation of the current implementation.`,
            );
          }

          const parameter = params[0];
          /// create temporary context provider for each mcp resource template
          /// For now this is necessary as we dont have an option to get from a submenu to a query input
          const Provider = createMCPTemplateContextProviderClass({
            // combine the MCP server name and resource name into a unique display name
            name: `${mcpId}.${resource.name}`,
            description: resource.description,
          });
          return new Provider({
            mcpId,
            parameter,
            uri: resource.uriTemplate,
          });
        },
      );
      config.contextProviders.push(...templateContextProviders);
    }

    // Tools <—> Tools
    if (capabilities?.tools) {
      const { tools } = await this.client.listTools({}, { signal });
      const continueTools: Tool[] = tools.map((tool: any) => ({
        displayTitle: name + " " + tool.name,
        function: {
          description: tool.description,
          name: tool.name,
          parameters: tool.inputSchema,
        },
        faviconUrl,
        readonly: false,
        type: "function",
        wouldLikeTo: `use the ${name} ${tool.name} tool`,
        uri: encodeMCPToolUri(mcpId, tool.name),
      }));

      config.tools = [...continueTools, ...config.tools];
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
