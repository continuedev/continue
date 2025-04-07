import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../";
import { MCPManagerSingleton } from "../mcp";

interface MCPContextProviderOptions {
  mcpId: string;
  serverName: string;
  submenuItems: ContextSubmenuItem[];
}

class MCPContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "mcp",
    displayTitle: "MCP",
    description: "Model Context Protocol",
    type: "submenu",
  };
  override get description(): ContextProviderDescription {
    return {
      title: `${MCPContextProvider.description.title}-${this.options["mcpId"]}`,
      displayTitle: this.options["serverName"]
        ? `${this.options["serverName"]} resources`
        : "MCP",
      description: "Model Context Protocol",
      type: "submenu",
    };
  }

  static encodeMCPResourceId(mcpId: string, uri: string): string {
    return JSON.stringify({ mcpId, uri });
  }

  static decodeMCPResourceId(mcpResourceId: string): {
    mcpId: string;
    uri: string;
  } {
    return JSON.parse(mcpResourceId);
  }

  constructor(options: MCPContextProviderOptions) {
    super(options);
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const { mcpId, uri } = MCPContextProvider.decodeMCPResourceId(query);

    const connection = MCPManagerSingleton.getInstance().getConnection(mcpId);
    if (!connection) {
      throw new Error(`No MCP connection found for ${mcpId}`);
    }

    const { contents } = await connection.client.readResource({ uri });

    return await Promise.all(
      contents.map(async (resource) => {
        const content = resource.text;
        if (typeof content !== "string") {
          throw new Error(
            "Continue currently only supports text resources from MCP",
          );
        }

        return {
          name: resource.uri,
          description: resource.uri,
          content,
          uri: {
            type: "url",
            value: resource.uri,
          },
        };
      }),
    );
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    return (this.options as MCPContextProviderOptions).submenuItems.map(
      (item) => ({
        ...item,
        id: JSON.stringify({
          mcpId: (this.options as MCPContextProviderOptions).mcpId,
          uri: item.id,
        }),
      }),
    );
  }
}

export default MCPContextProvider;
