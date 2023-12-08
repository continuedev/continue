import { ContextProvider, ContextProviderDescription } from "..";
import { ExtensionIde } from "../../ide";
import { ContextItem } from "../../llm/types";

class GitHubIssuesContextProvider extends ContextProvider {
  static description: ContextProviderDescription = {
    title: "github",
    displayTitle: "GitHub Issues",
    description: "Reference GitHub issues",
    dynamic: false,
    requiresQuery: false,
  };

  async getContextItems(query: string): Promise<ContextItem[]> {
    return [];
  }
  async load(): Promise<void> {}
}

export default GitHubIssuesContextProvider;
