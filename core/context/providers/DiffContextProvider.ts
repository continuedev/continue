import { ContextProvider, ContextProviderDescription } from "..";
import { ExtensionIde } from "../../ide";
import { ContextItem } from "../../llm/types";

class DiffContextProvider extends ContextProvider {
  static description: ContextProviderDescription = {
    title: "diff",
    displayTitle: "Git Diff",
    description: "Reference the current git diff",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItems(query: string): Promise<ContextItem[]> {
    return [await new ExtensionIde().getDiff()];
  }
  async load(): Promise<void> {}
}

export default DiffContextProvider;
