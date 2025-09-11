import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class GitHubIssuesContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "issue",
    displayTitle: "GitHub Issues",
    description: "Reference GitHub issues",
    type: "submenu",
  };

  get deprecationMessage() {
    return "The GitHub issues context provider is now deprecated and will be removed in a later version. Please consider using the GitHub MCP server (https://hub.continue.dev/anthropic/github-mcp) instead.";
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const issueId = query;
    const { Octokit } = await import("@octokit/rest");

    const octokit = new Octokit({
      auth: this.options?.githubToken,
      baseUrl: this.options?.domain
        ? `https://${this.options.domain}/api/v3`
        : undefined,
      request: {
        fetch: extras.fetch,
      },
    });

    const { owner, repo, issue_number } = JSON.parse(issueId);

    const issue = await octokit.issues.get({
      owner,
      repo,
      issue_number,
    });

    let content = `# GitHub Issue #${issue.data.number.toString()} in ${owner}/${repo}`;

    const comments = await octokit.issues.listComments({
      owner,
      repo,
      issue_number,
    });

    const parts = [
      issue.data.body || "No description",
      ...comments.data.map((comment) => comment.body),
    ];
    content += `\n\n${parts.join("\n\n---\n\n")}`;

    return [
      {
        name: issue.data.title,
        content,
        description: `#${issue.data.number.toString()}`,
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const { Octokit } = await import("@octokit/rest");

    const octokit = new Octokit({
      auth: this.options?.githubToken,
      request: {
        fetch: args.fetch,
      },
    });

    const allIssues = [];

    for (const repo of this.options?.repos) {
      const issues = await octokit.issues.listForRepo({
        owner: repo.owner,
        repo: repo.repo,
        state: repo.type || "open",
      });
      allIssues.push(
        ...issues.data.map((issue) => ({
          title: issue.title,
          description: `#${issue.number.toString()}`,
          id: JSON.stringify({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: issue.number,
          }),
        })),
      );
    }

    return allIssues;
  }
}

export default GitHubIssuesContextProvider;
