import { ContextItem, ContextProviderExtras } from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { MCPManagerSingleton } from "../mcp";

interface MCPTemplateContextProviderOptions {
  name: string;
  description: string;
}

class MCPTemplateContextProvider extends BaseContextProvider {
  private readonly _mcpId: string;
  private readonly _parameter: string;
  private readonly _uri: string;

  constructor(options: { mcpId: string; parameter: string; uri: string }) {
    super(options);
    this._mcpId = options.mcpId;
    this._parameter = options.parameter;
    this._uri = options.uri;
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const connection = MCPManagerSingleton.getInstance().getConnection(
      this._mcpId,
    );
    if (!connection) {
      throw new Error(`No MCP connection found for ${this._mcpId}`);
    }

    const uri = this._uri.replace(`{${this._parameter}}`, query);

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
}

// Factory to create subclasses with custom static descriptions
export function createMCPTemplateContextProviderClass(
  options: MCPTemplateContextProviderOptions,
): typeof MCPTemplateContextProvider {
  return class extends MCPTemplateContextProvider {
    static description = {
      title: options.name,
      displayTitle: options.name,
      description: options.description,
      type: "query",
    };
  };
}

export default MCPTemplateContextProvider;
