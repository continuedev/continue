import type { AxiosInstance } from "axios";
import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../..";
const { convert } = require("adf-to-md");

interface JiraComment {
  id: string;
  created: string;
  updated: string;
  author: {
    emailAddress: string;
    displayName: string;
  };
  body: object;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: object;
    comment: {
      total: number;
      comments: Array<JiraComment>;
    };
  };
}

interface QueryResults {
  issues: JiraIssue[];
}

class JiraIssuesContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "jira",
    displayTitle: "Jira Issues",
    description: "Reference Jira issues",
    type: "submenu",
  };

  private async createApi(): Promise<AxiosInstance> {
    const { default: Axios } = await import("axios");

    return Axios.create({
      baseURL: `https://${this.options.domain}/rest/api/3/`,
      auth: {
        username: this.options.email,
        password: this.options.token,
      },
    });
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const issueId = query;

    const api = await this.createApi();

    const issue = await api
      .get<JiraIssue>(`/issue/${issueId}`, {
        params: {
          fields: "description,comment,summary",
        },
      })
      .then((result) => result.data);

    const parts = [
      `# Jira Issue ${issue.key}: ${issue.fields.summary}`,
      "## Description",
      issue.fields.description
        ? convert(issue.fields.description).result
        : "No description",
    ];

    if (issue.fields.comment.comments.length > 0) {
      parts.push("## Comments");

      parts.push(
        ...issue.fields.comment.comments.map((comment) => {
          const commentText = convert(comment.body).result;

          return `### ${comment.author.displayName} on ${comment.created}\n\n${commentText}`;
        }),
      );
    }

    const content = parts.join("\n\n");

    return [
      {
        name: `${issue.key}: ${issue.fields.summary}`,
        content,
        description: issue.key,
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const api = await this.createApi();

    try {
      const results = await api.get<QueryResults>("/search", {
        params: {
          jql:
            this.options.issueQuery ??
            `assignee = currentUser() AND resolution = Unresolved order by updated DESC`,
          fields: "summary",
        },
      });

      return results.data.issues.map((issue) => ({
        id: issue.id,
        title: `${issue.key}: ${issue.fields.summary}`,
        description: "",
      }));
    } catch (ex) {
      console.error(`Unable to get jira tickets: ${ex}`);
      return [];
    }
  }
}

export default JiraIssuesContextProvider;
