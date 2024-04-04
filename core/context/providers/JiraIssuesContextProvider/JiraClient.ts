import { RequestOptions } from "../../..";
import { fetchwithRequestOptions } from "../../../util/fetchWithOptions";
const { convert: adf2md } = require("adf-to-md");

interface JiraClientOptions {
  domain: string;
  username: string;
  password: string;
  issueQuery?: string;
  apiVersion?: string;
  requestOptions?: RequestOptions;
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
  private baseUrl: string;
  private authHeader;
  constructor(options: JiraClientOptions) {
    this.options = {
      issueQuery: `assignee = currentUser() AND resolution = Unresolved order by updated DESC`,
      apiVersion: "3",
      requestOptions: {},
      ...options,
    };
    this.baseUrl = `https://${this.options.domain}/rest/api/${this.options.apiVersion}`;
    this.authHeader = this.options.username
      ? {
          Authorization:
            "Basic " +
            btoa(this.options.username + ":" + this.options.password),
        }
      : {
          Authorization: `Bearer ${this.options.password}`,
        };
  }

  async issue(issueId: string): Promise<Issue> {
    const result = {} as Issue;

    const response = await fetchwithRequestOptions(
      new URL(
        this.baseUrl + `/issue/${issueId}?fields=description,comment,summary`
      ),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeader,
        },
      },
      this.options.requestOptions
    );

    const issue = (await response.json()) as any;

    result.key = issue.key;
    result.summary = issue.fields.summary;

    if (typeof issue.fields.description === "string") {
      result.description = issue.fields.description;
    } else if (issue.fields.description) {
      result.description = adf2md(issue.fields.description).result;
    } else {
      result.description = "";
    }

    result.comments =
      issue.fields.comment?.comments?.map((comment: any) => {
        const body =
          typeof comment.body === "string"
            ? comment.body
            : adf2md(comment.body).result;

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
    const response = await fetchwithRequestOptions(
      new URL(
        this.baseUrl +
          `/search?fields=summary&jql=${
            this.options.issueQuery ??
            `assignee = currentUser() AND resolution = Unresolved order by updated DESC`
          }`
      ),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeader,
        },
      },
      this.options.requestOptions
    );

    if (response.status != 200) {
      console.warn(
        "Unable to get jira tickets. Response code from API is",
        response.status
      );
      return Promise.resolve([]);
    }

    const data = (await response.json()) as any;

    return (
      data.issues?.map((issue: any) => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
      })) ?? []
    );
  }
}
