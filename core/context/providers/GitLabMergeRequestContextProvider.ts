import type { AxiosInstance, AxiosError } from "axios";
import {BaseContextProvider} from "..";
import { ContextProviderExtras, ContextItem, ContextProviderDescription } from "../..";

interface RemoteBranchInfo {
  branch: string | null;
  project: string | null;
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
      baseURL: `https://${domain ?? "gitlab.com"}/api`,
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

    const parts = [`# ${this.description.displayTitle}`];  

    const { branch, project } = await this.getRemoteBranchName(extras);
  
    const api = await this.getApi();
  
    try {
    const mergeRequests = await api
      .get<Array<{ iid: number; project_id: number }>>(
        `/v4/projects/${encodeURIComponent(project!)}/merge_requests`,
        {
          params: {
            source_branch: branch,
            state: "opened",
          },
        }
      )
      .then((x) => x.data);
  
      if (mergeRequests?.length) {
        const mergeRequest = mergeRequests[0];
  
        parts.push(`Merge Request: ${mergeRequest.iid}`);
  
        const comments = await api.get<Array<GitLabComment>>(
          `/v4/projects/${mergeRequest.project_id}/merge_requests/${mergeRequest.iid}/notes`,
          {
            params: {
              sort: "asc",
              order_by: "created_at",
            },
          }
        );
  
        const locations = {} as Record<string, Array<GitLabComment>>;
  
        for (const comment of comments.data.filter(
          (x) => x.type === "DiffNote"
        )) {
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
      }
  
      const content = parts.join("\n\n");
  
      return [
        {
          name: `GitLab MR Comments`,
          content,
          description: `Comments from the Merge Request for this branch.`,
        },
      ];
    } catch(ex) {
      if(ex instanceof AxiosError) {

      }
    }
  }

}

export default GitLabMergeRequestContextProvider;