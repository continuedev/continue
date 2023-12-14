import { v4 } from "uuid";
import { BaseContextProvider } from "..";
import { ContextItem, ContextProviderDescription } from "../..";
import { ExtensionIde } from "../../ide";

class TerminalContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "terminal",
    displayTitle: "Terminal",
    description: "Reference the contents of the terminal",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItems(query: string): Promise<ContextItem[]> {
    const content = await new ExtensionIde().getTerminalContents();
    return [
      {
        description: "The contents of the terminal",
        content,
        name: "Terminal",
        id: {
          providerTitle: "terminal",
          itemId: v4(),
        },
      },
    ];
  }
  async load(): Promise<void> {}
}

export default TerminalContextProvider;
