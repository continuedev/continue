import { AxiosError, AxiosInstance } from "axios";

import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

interface RemoteBranchInfo {
  branch: string | null;
  project: string | null;
}

interface GitLabUser {
  id: number;
  username: string;
  name: string;
  state: "active";
  locked: boolean;
  avatar_url: string;
  web_url: string;
}

interface GitLabMergeRequest {
  iid: number;
  project_id: number;
  title: string;
  description: string;
}

interface GitLabComment {
  type: null | "DiffNote";
  resolvable: boolean;
  resolved?: boolean;
  body: string;
  created_at: string;
  author: GitLabUser;
  position?: {
    new_path: string;
    new_line: number;
    head_sha: string;
    line_range: {
      start: {
        line_code: string;
        type: "new";
        old_line: null;
        new_line: number;
      };
      end: {
        line_code: string;
        type: "new";
        old_line: null;
        new_line: number;
      };
    };
  };
}

const trimFirstElement = (args: Array<string>): string => {
  return args[0].trim();
};

const getSubprocess = async (extras: ContextProviderExtras) => {
  const workingDir = await extras.ide.getWorkspaceDirs().then(trimFirstElement);

  return (command: string) =>
    extras.ide.subprocess(command, workingDir).then(trimFirstElement);
};

class GitLabMergeRequestContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "gitlab-mr",
    displayTitle: "GitLab Merge Request",
    description: "Reference comments in a GitLab Merge Request",
    type: "normal",
  };

  private async getApi(): Promise<AxiosInstance> {
    const { default: Axios } = await import("axios");

    const domain = this.options.domain ?? "gitlab.com";
    const token = this.options.token;

    if (!token) {
      throw new Error("GitLab Private Token is required!");
    }

    return Axios.create({
      baseURL: `https://${domain ?? "gitlab.com"}/api/v4`,
      headers: {
        "PRIVATE-TOKEN": token,
      },
    });
  }

  private async getRemoteBranchInfo(
    extras: ContextProviderExtras,
  ): Promise<RemoteBranchInfo> {
    const subprocess = await getSubprocess(extras);

    const branchName = await subprocess("git branch --show-current");

    const branchRemote = await subprocess(
      `git config branch.${branchName}.remote`,
    );

    const branchInfo = await subprocess("git branch -vv");

    const currentBranchInfo = branchInfo
      .split("\n")
      .find((line) => line.startsWith("*"));

    const remoteMatches = RegExp(
      `\\[${branchRemote}/(?<remote_branch>[^\\]]+)\\]`,
    ).exec(currentBranchInfo!);

    console.dir({ remoteMatches });

    const remoteBranch = remoteMatches?.groups?.remote_branch ?? null;

    const remoteUrl = await subprocess(`git remote get-url ${branchRemote}`);

    let urlMatches: RegExpExecArray | null;
    if (/https?.*/.test(remoteUrl)) {
      const pathname = new URL(remoteUrl).pathname;
      urlMatches = /\/(?<projectPath>.*?)(?:(?=\.git)|$)/.exec(pathname)
    } else {
      // ssh
      urlMatches = /:(?<projectPath>.*).git/.exec(remoteUrl)
    }

    const project = urlMatches?.groups?.projectPath ?? null;

    return {
      branch: remoteBranch,
      project,
    };
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const { branch, project } = await this.getRemoteBranchInfo(extras);

    const api = await this.getApi();

    const result = [] as Array<ContextItem>;

    try {
      const mergeRequests = await api
        .get<Array<GitLabMergeRequest>>(
          `/projects/${encodeURIComponent(project!)}/merge_requests`,
          {
            params: {
              source_branch: branch,
              state: "opened",
            },
          },
        )
        .then((x) => x.data);

      const subprocess = await getSubprocess(extras);

      for (const mergeRequest of mergeRequests) {
        const parts = [
          `# GitLab Merge Request\ntitle: "${
            mergeRequest.title
          }"\ndescription: "${mergeRequest.description ?? "None"}"`,
          "## Comments",
        ];

        const comments = await api.get<Array<GitLabComment>>(
          `/projects/${mergeRequest.project_id}/merge_requests/${mergeRequest.iid}/notes`,
          {
            params: {
              sort: "asc",
              order_by: "created_at",
            },
          },
        );

        const filteredComments = comments.data.filter(
          (x) => x.type === "DiffNote",
        );

        const locations = {} as Record<string, Array<GitLabComment>>;

        for (const comment of filteredComments) {
          const filename = comment.position?.new_path ?? "general";

          if (!locations[filename]) {
            locations[filename] = [];
          }

          locations[filename].push(comment);
        }

        if (extras.selectedCode.length && this.options.filterComments) {
          const toRemove = Object.keys(locations).filter(
            (filename) =>
              !extras.selectedCode.find((selection) =>
                selection.filepath.endsWith(filename),
              ) && filename !== "general",
          );
          for (const filepath of toRemove) {
            delete locations[filepath];
          }
        }

        const commentFormatter = async (comment: GitLabComment) => {
          const commentLabel = comment.body.includes("```suggestion")
            ? "Code Suggestion"
            : "Comment";
          let result = `#### ${commentLabel}\nauthor: "${
            comment.author.name
          }"\ndate: "${comment.created_at}"\nresolved: ${
            comment.resolved ? "Yes" : "No"
          }`;

          if (comment.position?.new_line) {
            result += `\nline: ${comment.position.new_line}`;

            if (comment.position.head_sha) {
              const sourceLines = await subprocess(
                `git show ${comment.position.head_sha}:${comment.position.new_path}`,
              )
                .then((result) => result.split("\n"))
                .catch((ex) => []);

              const line =
                comment.position.new_line <= sourceLines.length
                  ? sourceLines[comment.position.new_line - 1]
                  : null;

              if (line) {
                result += `\nsource: \`${line}\``;
              }
            }
          }

          result += `\n\n${comment.body}`;

          return result;
        };

        for (const [filename, locationComments] of Object.entries(locations)) {
          if (filename !== "general") {
            parts.push(`### File ${filename}`);
            locationComments.sort(
              (a, b) =>
                (a.position?.new_line ?? 0) - (b.position?.new_line ?? 0),
            );
          } else {
            parts.push("### General");
          }

          const commentSections = await Promise.all(
            locationComments.map(commentFormatter),
          );
          parts.push(...commentSections);
        }

        const content = parts.join("\n\n");

        result.push({
          name: mergeRequest.title,
          content,
          description: "Comments from the Merge Request for this branch.",
        });
      }
    } catch (ex) {
      let content = "# GitLab Merge Request\n\nError getting merge request. ";
      if (ex instanceof AxiosError) {
        if (ex.response) {
          const errorMessage = ex.response?.data
            ? (ex.response.data.message ?? JSON.stringify(ex.response?.data))
            : `${ex.response.status}: ${ex.response.statusText}`;
          content += `GitLab Error: ${errorMessage}`;
        } else {
          content += `GitLab Request Error ${ex.request}`;
        }
      } else {
        // @ts-ignore
        content += `Unknown error: ${ex.message ?? JSON.stringify(ex)}`;
      }

      result.push({
        name: "GitLab Merge Request",
        content,
        description: "Error getting the Merge Request for this branch.",
      });
    }

    return result;
  }
}

export default GitLabMergeRequestContextProvider;
