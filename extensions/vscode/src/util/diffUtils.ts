import { Repository } from "../otherExtensions/git";
import { VsCodeIdeUtils } from "./ideUtils";
import * as vscode from "vscode";

export class DiffUtils extends VsCodeIdeUtils {
  private async getRepos(): Promise<Repository[]> {
    const workspaceDirs = this.getWorkspaceDirectories();

    const repos: (Repository | undefined)[] = await Promise.all(
      workspaceDirs.map((dir) => {
        return this.getRepo(vscode.Uri.file(dir));
      }),
    );

    return repos.filter((repo) => !!repo);
  }

  private splitDiff(diffString: string): string[] {
    const fileDiffHeaderRegex = /(?=diff --git a\/.* b\/.*)/;

    const diffs = diffString.split(fileDiffHeaderRegex);

    if (diffs[0].trim() === "") {
      diffs.shift();
    }

    return diffs;
  }

  private async getRepoDiff(repo: Repository) {
    const staged = await repo.diff(true);
    const unstaged = await repo.diff(false);

    return [staged, unstaged].map((diff) => this.splitDiff(diff)).flat();
  }

  public async getLatestChanges() {
    const repos = await this.getRepos();

    const latestChanges: string[] = [];

    for (const repo of repos) {
      const changes = await this.getRepoDiff(repo);
      latestChanges.push(...changes);
    }

    return latestChanges;
  }
}
