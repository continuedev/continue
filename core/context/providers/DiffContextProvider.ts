import { v4 } from "uuid";
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
    const diff = await new ExtensionIde().getDiff();
    return [
      {
        description: "The current git diff",
        content: diff,
        name: "Git Diff",
        id: {
          providerTitle: "diff",
          itemId: v4(),
        },
      },
    ];
  }
  async load(): Promise<void> {}
}

export default DiffContextProvider;
