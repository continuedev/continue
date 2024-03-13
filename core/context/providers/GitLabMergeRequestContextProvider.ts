import { AxiosInstance, AxiosError } from "axios";
import {BaseContextProvider} from "..";
import { ContextProviderExtras, ContextItem, ContextProviderDescription } from "../..";

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


class GitLabMergeRequestContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: 'gitlab-mr',
    displayTitle: 'GitLab Merge Request',
    description: 'Reference comments in a GitLab Merge Request',
    type: 'normal'
  };

  private async getApi(): Promise<AxiosInstance> {
    const { default: Axios } = await import("axios");

    const domain = this.options.domain ?? "gitlab.com";
    const token = this.options.token;

    if(!token) {
      throw new Error(`GitLab Private Token is required!`);
    }
  
    return Axios.create({
      baseURL: `https://${domain ?? "gitlab.com"}/api/v4`,
      headers: {
        "PRIVATE-TOKEN": token,
      },
    });
  };


  private async getRemoteBranchName(extras: ContextProviderExtras): Promise<RemoteBranchInfo> {

    const workingDir = await extras.ide
    .getWorkspaceDirs()
    .then(trimFirstElement);

    const subprocess = (command: string) =>
    extras.ide
      .subprocess(`cd ${workingDir}; ${command}`)
        .then(trimFirstElement);
    
    const branchName = await subprocess(`git branch --show-current`);
  
    const branchRemote = await subprocess(
      `git config branch.${branchName}.remote`
    );
  
    const branchInfo = await subprocess(`git branch -vv`);
  
    const currentBranchInfo = branchInfo
      .split("\n")
      .find((line) => line.startsWith("*"));
  
    const remoteMatches = RegExp(
      `\\[${branchRemote}/(?<remote_branch>[^\\]]+)\\]`
    ).exec(currentBranchInfo!);
  
    console.dir({ remoteMatches });
  
    const remoteBranch = remoteMatches?.groups?.["remote_branch"] ?? null;
  
    const remoteUrl = await subprocess(`git remote get-url ${branchRemote}`);
  
    const urlMatches = RegExp(`:(?<project>.*).git`).exec(remoteUrl);
  
    const project = urlMatches?.groups?.["project"] ?? null;
  
    return {
      branch: remoteBranch,
      project,
    };
  };

  async getContextItems(query: string, extras: ContextProviderExtras): Promise<ContextItem[]> { 

    const { branch, project } = await this.getRemoteBranchName(extras);
  
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
        }
      )
      .then((x) => x.data);
  
      for (const mergeRequest of mergeRequests) {
        const parts = [
          `# ${mergeRequest.title}`
        ];

        if (mergeRequest?.description) {
          parts.push(`## Description`, mergeRequest.description);
        }
  
        const comments = await api.get<Array<GitLabComment>>(
          `/projects/${mergeRequest.project_id}/merge_requests/${mergeRequest.iid}/notes`,
          {
            params: {
              sort: "asc",
              order_by: "created_at",
            },
          }
        );

        const filteredComments = comments.data.filter(
          (x) => x.type === "DiffNote"
        );
  
        const locations = {} as Record<string, Array<GitLabComment>>;
  
        for (const comment of filteredComments) {
          const filename = comment.position?.new_path ?? "general";
  
          if (!locations[filename]) {
            locations[filename] = [];
          }
  
          locations[filename].push(comment);
        }
  
        const commentFormatter = (comment: GitLabComment) => {
          const commentParts = [
            `### ${comment.author.name} on ${comment.created_at}${
              comment.resolved ? " (Resolved)" : ""
            }`,
          ];
  
          if (comment.position?.new_line) {
            commentParts.push(
              `line: ${comment.position.new_line}\ncommit: ${comment.position.head_sha}`
            );
          }
  
          commentParts.push(comment.body);
  
          return commentParts.join("\n\n");
        };
  
        for (const [filename, locationComments] of Object.entries(locations)) {
          if (filename !== "general") {
            parts.push(`## File ${filename}`);
            locationComments.sort(
              (a, b) => a.position!.new_line - b.position!.new_line
            );
          } else {
            parts.push("## Comments");
          }
  
          parts.push(...locationComments.map(commentFormatter));
        }


      const content = parts.join("\n\n");
  
      result.push(
        {
          name: mergeRequest.title,
          content,
          description: `Comments from the Merge Request for this branch.`,
        },
      );
      }
  
    } catch(ex) {
      if(ex instanceof AxiosError) {
        if (ex.response) {
          throw ex.response?.data ?? new Error(`GitLab error ${ex.response.status}: ${ex.response.statusText}`);
        } else {
          throw new Error(`GitLab Request Error ${ex.request}`);
        }
      }

      throw ex;
    }

    return result;
  }

}

export default GitLabMergeRequestContextProvider;