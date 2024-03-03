import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

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
    const diff = await extras.ide.getDiff();
    return [
      {
        description: "The current git diff",
        content: `\`\`\`git diff\n${diff}\n\`\`\``,
        name: "Git Diff",
      },
    ];
  }
}

export default DiffContextProvider;
