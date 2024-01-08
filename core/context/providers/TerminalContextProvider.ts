import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import { ExtensionIde } from "../../ide";

class TerminalContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "terminal",
    displayTitle: "Terminal",
    description: "Reference the contents of the terminal",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    const content = await new ExtensionIde().getTerminalContents();
    return [
      {
        description: "The contents of the terminal",
        content: `Current terminal contents:\n\n${content}`,
        name: "Terminal",
      },
    ];
  }
  async load(): Promise<void> {}
}

export default TerminalContextProvider;
