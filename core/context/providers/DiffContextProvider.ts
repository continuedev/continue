import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class DiffContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "diff",
    displayTitle: "Git Diff",
    description: "Reference the current git diff",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const diff = await extras.ide.getDiff(this.options.includeUnstaged ?? true);
    return [
      {
        description: "The current git diff",
        content:
          diff.length === 0
            ? "Git shows no current changes."
            : `\`\`\`git diff\n${diff.join("\n")}\n\`\`\``,
        name: "Git Diff",
      },
    ];
  }
}

export default DiffContextProvider;
