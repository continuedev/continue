import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../";

interface MCPContextProviderOptions {
  submenuItems: ContextSubmenuItem[];
  client: Client;
}

class MCPContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "mcp",
    displayTitle: "MCP",
    description: "Model Context Protocol",
    type: "submenu",
  };

  constructor(options: MCPContextProviderOptions) {
    super(options);
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const { contents } = await (
      this.options as MCPContextProviderOptions
    ).client.readResource({ uri: query });

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
    return (this.options as MCPContextProviderOptions).submenuItems;
  }
}

export default MCPContextProvider;
