import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../";
import { MCPManagerSingleton } from "../mcp/MCPManagerSingleton";

interface MCPContextProviderOptions {
  mcpId: string;
  serverName: string;
  submenuItems: ContextSubmenuItem[];
}

class MCPContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "mcp",
    displayTitle: "MCP",
    description: "MCP Resources",
    type: "submenu",
    renderInlineAs: "",
  };
  override get description(): ContextProviderDescription {
    return {
      title: `${MCPContextProvider.description.title}-${this.options["mcpId"]}`,
      displayTitle: this.options["serverName"]
        ? `${this.options["serverName"]} resources`
        : "MCP",
      renderInlineAs: "",
      description: "MCP Resources",
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

  /**
   * Continue experimentally supports resource templates (https://modelcontextprotocol.io/docs/concepts/resources#resource-templates)
   * by allowing specifically just the "query" variable in the template, which we will update with the full input of the user in the input box
   */
  private insertInputToUriTemplate(uri: string, query: string): string {
    const TEMPLATE_VAR = "query";
    if (uri.includes(`{${TEMPLATE_VAR}}`)) {
      // Sending an empty string will result in an error, so we instead send "null"
      const queryOrNull = query.trim() === "" ? "null" : query;
      return uri.replace(`{${TEMPLATE_VAR}}`, encodeURIComponent(queryOrNull));
    }
    return uri;
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

    const { contents } = await connection.client.readResource({
      uri: this.insertInputToUriTemplate(uri, extras.fullInput),
    });

    return await Promise.all(
      contents.map(async (resource) => {
        if (!("text" in resource) || typeof resource.text !== "string") {
          throw new Error(
            "Continue currently only supports text resources from MCP",
          );
        }
        return {
          name: resource.uri,
          description: resource.uri,
          content: resource.text,
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
