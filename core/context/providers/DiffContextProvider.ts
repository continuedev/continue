import { BaseContextProvider } from "..";
import { ContextItem, ContextProviderDescription } from "../..";
import { ExtensionIde } from "../../ide";

class DiffContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "diff",
    displayTitle: "Git Diff",
    description: "Reference the current git diff",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItems(query: string): Promise<ContextItem[]> {
    const diff = await new ExtensionIde().getDiff();
    return [
      {
        description: "The current git diff",
        content: diff,
        name: "Git Diff",
      },
    ];
  }
  async load(): Promise<void> {}
}

export default DiffContextProvider;
