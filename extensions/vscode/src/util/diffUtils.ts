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
}
