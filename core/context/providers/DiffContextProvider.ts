import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import { ExtensionIde } from "../../ide";

class DiffContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "diff",
    displayTitle: "Git Diff",
    description: "Reference the current git diff",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    const diff = await new ExtensionIde().getDiff();
    return [
      {
        description: "The current git diff",
        content: `\`\`\`git diff\n${diff}\n\`\`\``,
        name: "Git Diff",
      },
    ];
  }
  async load(): Promise<void> {}
}

export default DiffContextProvider;
