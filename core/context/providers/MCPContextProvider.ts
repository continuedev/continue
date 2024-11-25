import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  ListResourcesResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../";

interface StdioOptions {
  type: "stdio";
  command: string;
  args: string[];
}

interface WebSocketOptions {
  type: "websocket";
  url: string;
}

interface SSEOptions {
  type: "sse";
  url: string;
}

type TransportOptions = StdioOptions | WebSocketOptions | SSEOptions;

interface MCPContextProviderOptions {
  transport: TransportOptions;
}

class MCPContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "mcp",
    displayTitle: "MCP",
    description: "Model Context Protocol",
    type: "submenu",
  };

  private client: Client;

  private constructTransport(options: MCPContextProviderOptions): Transport {
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

  private resourcesPromise: Promise<any>;

  constructor(options: MCPContextProviderOptions) {
    super(options);

    const transport = this.constructTransport(options);

    this.client = new Client(
      {
        name: "continue-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    let resourcesResolve: (resources: any) => void;
    this.resourcesPromise = new Promise((resolve) => {
      resourcesResolve = resolve;
    });

    void this.client
      .connect(transport)
      .then(async () => {
        const resources = await this.client.request(
          { method: "resources/list" },
          ListResourcesResultSchema,
        );
        resourcesResolve(resources.resources);
      })
      .catch((error) => {
        console.error(
          "Error connecting to Model Context Protocol server",
          error,
        );
      });
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const resourceContent = await this.client.request(
      {
        method: "resources/read",
        params: {
          uri: query,
        },
      },
      ReadResourceResultSchema,
    );

    return [
      {
        name: "1",
        description: "text",
        content: "resourceContent",
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const resources = await this.resourcesPromise;

    return resources.map((resource: any) => ({
      title: resource.name,
      description: resource.description,
      id: resource.uri,
    }));
  }
}

export default MCPContextProvider;
