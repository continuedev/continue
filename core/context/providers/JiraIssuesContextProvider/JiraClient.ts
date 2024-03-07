
import type { AxiosInstance } from "axios";
const { convert: adf2md } = require("adf-to-md");

interface JiraClientOptions {
  domain: string;
  username: string;
  password: string;
  issueQuery?: string;
  apiVersion?: string;
}

interface JiraComment {
  id: string;
  created: string;
  updated: string;
  author: {
    emailAddress: string;
    displayName: string;
  };
  body: object | string;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: object | string;
    comment: {
      total: number;
      comments: Array<JiraComment>;
    };
  };
}

interface QueryResult {
  id: string;
  key: string;
  summary: string;
}

interface QueryResults {
  issues: JiraIssue[];
}

export interface Comment {
  created: string;
  updated: string;
  author: {
    emailAddress: string;
    displayName: string;
  };
  body: string;
}

export interface Issue {
  key: string;
  summary: string;
  description?: string;
  comments: Array<Comment>;
}

export class JiraClient {
  private readonly options: Required<JiraClientOptions>;
  private _api: AxiosInstance | null = null;
  constructor(options: JiraClientOptions) {
    this.options = {
      issueQuery: `assignee = currentUser() AND resolution = Unresolved order by updated DESC`,
      apiVersion: '3',
      ...options
    };
  }

  private async getApi() {
    if (!this._api) {
      
    const { default: Axios } = await import("axios");

      this._api = Axios.create({
        baseURL: `https://${this.options.domain}/rest/api/${this.options.apiVersion}/`,
        auth: {
          username: this.options.username,
          password: this.options.password,
        },
      });
    }

    return this._api;
  }

  async issue(issueId: string): Promise<Issue> {
    const api = await this.getApi();
    const result = {} as Issue;

    const issue = await api
      .get<JiraIssue>(`/issue/${issueId}`, {
        params: {
          fields: "description,comment,summary",
        },
      })
      .then((result) => result.data);
    
    result.key = issue.key;
    result.summary = issue.fields.summary;

    
    if (typeof issue.fields.description === 'string') {
      result.description = issue.fields.description;
    } else if(issue.fields.description) {
      result.description = adf2md(issue.fields.description).result;
    } else {
      result.description = "";
    }

    result.comments = issue.fields.comment?.comments?.map((comment) => {
      const body = typeof comment.body === 'string' ? comment.body : adf2md(comment.body).result;

      return {
        body,
        author: comment.author,
        created: comment.created,
        updated: comment.updated,
      };
    }) ?? [];


    return result;
  }

  async listIssues(): Promise<Array<QueryResult>> {
    const api = await this.getApi();

    const results = await api.get<QueryResults>("/search", {
      params: {
        jql:
          this.options.issueQuery ??
          `assignee = currentUser() AND resolution = Unresolved order by updated DESC`,
        fields: "summary",
      },
    });

    return results.data?.issues?.map((issue) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
    })) ?? [];
  }
}