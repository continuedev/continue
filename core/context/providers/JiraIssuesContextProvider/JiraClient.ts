// @ts-ignore
import adf2md from "adf-to-md";

import { RequestOptions } from "../../../";

interface JiraClientOptions {
  domain: string;
  username: string;
  password: string;
  issueQuery?: string;
  apiVersion?: string;
  maxResults?: string;
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
      issueQuery:
        "assignee = currentUser() AND resolution = Unresolved order by updated DESC",
      apiVersion: "3",
      requestOptions: {},
      maxResults: "50",
      ...options,
    };
    this.baseUrl = `https://${this.options.domain}/rest/api/${this.options.apiVersion}`;
    this.authHeader = this.options.username
      ? {
          Authorization: `Basic ${btoa(
            `${this.options.username}:${this.options.password}`,
          )}`,
        }
      : {
          Authorization: `Bearer ${this.options.password}`,
        };
  }

  async issue(
    issueId: string,
    customFetch: (url: string | URL, init: any) => Promise<any>,
  ): Promise<Issue> {
    const result = {} as Issue;

    const response = await customFetch(
      new URL(
        this.baseUrl + `/issue/${issueId}?fields=description,comment,summary`,
      ),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeader,
        },
      },
    );

    const issue = (await response.json()) as any;

    result.key = issue.key;
    result.summary = issue.fields.summary;

    if (typeof issue.fields.description === "string") {
      result.description = issue.fields.description;
    } else if (issue.fields.description) {
      result.description = adf2md.validate(issue.fields.description).result;
    } else {
      result.description = "";
    }

    result.comments =
      issue.fields.comment?.comments?.map((comment: any) => {
        const body =
          typeof comment.body === "string"
            ? comment.body
            : adf2md.validate(comment.body).result;

        return {
          body,
          author: comment.author,
          created: comment.created,
          updated: comment.updated,
        };
      }) ?? [];

    return result;
  }

  async listIssues(
    customFetch: (url: string | URL, init: any) => Promise<any>,
  ): Promise<Array<QueryResult>> {
    const response = await customFetch(
      new URL(
        this.baseUrl +
          `/search?fields=summary&jql=${
            this.options.issueQuery ??
            "assignee = currentUser() AND resolution = Unresolved order by updated DESC"
          }&maxResults=${this.options.maxResults}`,
      ),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeader,
        },
      },
    );

    if (response.status === 500) {
      const text = await response.text();
      console.warn(
        "Unable to get Jira tickets. You may need to set 'apiVersion': 2 in your config.json. See full documentation here: https://docs.continue.dev/customize/context-providers#jira-datacenter-support\n\n",
        text,
      );
      return Promise.resolve([]);
    } else if (response.status !== 200) {
      const text = await response.text();
      console.warn("Unable to get Jira tickets: ", text);
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
