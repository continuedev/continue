import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../../index.js";
import { BaseContextProvider } from "../../index.js";

import { JiraClient } from "./JiraClient.js";

class JiraIssuesContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "jira",
    displayTitle: "Jira Issues",
    description: "Reference Jira issues",
    type: "submenu",
  };

  private getApi() {
    return new JiraClient({
      domain: this.options.domain,
      username: this.options.email,
      password: this.options.token,
      issueQuery: this.options.issueQuery,
      apiVersion: this.options.apiVersion,
      requestOptions: this.options.requestOptions,
      maxResults: this.options.maxResults
    });
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const api = this.getApi();
    const issue = await api.issue(query, extras.fetch);

    const parts = [
      `# Jira Issue ${issue.key}: ${issue.summary}`,
      "## Description",
      issue.description ?? "No description",
    ];

    if (issue.comments.length > 0) {
      parts.push("## Comments");

      parts.push(
        ...issue.comments.map((comment) => {
          return `### ${comment.author.displayName} on ${comment.created}\n\n${comment.body}`;
        }),
      );
    }

    const content = parts.join("\n\n");

    return [
      {
        name: `${issue.key}: ${issue.summary}`,
        content,
        description: issue.key,
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const api = await this.getApi();

    try {
      const issues = await api.listIssues(args.fetch);

      return issues.map((issue) => ({
        id: issue.id,
        title: `${issue.key}: ${issue.summary}`,
        description: "",
      }));
    } catch (ex) {
      console.error(`Unable to get jira tickets: ${ex}`);
      return [];
    }
  }
}

export default JiraIssuesContextProvider;
