import { URL } from "node:url";

import { Octokit } from "@octokit/rest";

import { PageData } from "../DocsCrawler";

class GitHubCrawler {
  private readonly markdownRegex = new RegExp(/\.(md|mdx)$/);
  private octokit = new Octokit({ auth: undefined });

  constructor(private readonly startUrl: URL) {}

  async *crawl(): AsyncGenerator<PageData> {
    console.debug(
      `[${
        (this.constructor as any).name
      }] Crawling GitHub repo: ${this.startUrl.toString()}`,
    );
    const urlStr = this.startUrl.toString();
    const [_, owner, repo] = this.startUrl.pathname.split("/");
    const branch = await this.getGithubRepoDefaultBranch(owner, repo);
    const paths = await this.getGitHubRepoPaths(owner, repo, branch);

    for await (const path of paths) {
      const content = await this.getGithubRepoFileContent(path, owner, repo);
      yield { path, url: urlStr, content: content ?? "" };
    }
  }

  private async getGithubRepoDefaultBranch(
    owner: string,
    repo: string,
  ): Promise<string> {
    const repoInfo = await this.octokit.repos.get({ owner, repo });
    return repoInfo.data.default_branch;
  }

  private async getGitHubRepoPaths(
    owner: string,
    repo: string,
    branch: string,
  ) {
    const tree = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      {
        owner,
        repo,
        tree_sha: branch,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
        recursive: "true",
      },
    );

    return tree.data.tree
      .filter(
        (file: any) =>
          file.type === "blob" && this.markdownRegex.test(file.path ?? ""),
      )
      .map((file: any) => file.path);
  }

  private async getGithubRepoFileContent(
    path: string,
    owner: string,
    repo: string,
  ) {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        headers: { Accept: "application/vnd.github.raw+json" },
      });
      return response.data as unknown as string;
    } catch (error) {
      console.debug("Error fetching file contents:", error);
      return null;
    }
  }
}

export default GitHubCrawler;
