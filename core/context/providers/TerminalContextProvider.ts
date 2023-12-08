import { ContextProvider, ContextProviderDescription } from "..";
import { ExtensionIde } from "../../ide";
import { ContextItem } from "../../llm/types";

class TerminalContextProvider extends ContextProvider {
  static description: ContextProviderDescription = {
    title: "terminal",
    displayTitle: "Terminal",
    description: "Reference the contents of the terminal",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItem(query: string): Promise<ContextItem[]> {
    return [await new ExtensionIde().getTerminalContents()];
  }
  async load(): Promise<void> {}
}

export default TerminalContextProvider;
