import { BaseContextProvider } from "..";
import { ContextItem, ContextProviderDescription } from "../..";

class GitHubIssuesContextProvider extends BaseContextProvider {
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
