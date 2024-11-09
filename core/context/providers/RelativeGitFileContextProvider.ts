import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { walkDir } from "../../indexing/walkDir.js";
import {
  getBasename,
  getUniqueFilePath,
  groupByLastNPathParts,
} from "../../util/index.js";
import { BaseContextProvider } from "../index.js";
import { execSync } from "child_process";

const MAX_SUBMENU_ITEMS = 10_000;

class RelativeGitFileContextProvider extends BaseContextProvider {
   private gitRootCache: Record<string, string> = {};

 static description: ContextProviderDescription = {
    title: "relativegitfilecontext",
    displayTitle: "Files",
    description: "Add file to context relative to the git root.",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const gitRoot = this.getGitRoot(workspaceDirs[0]);
    const relativePath = this.normalizeRelativePath(query, gitRoot);
    return [
      {
        name: getBasename(query),
        description: relativePath,
        content: relativePath,
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    const results = await Promise.all(
      workspaceDirs.map((dir) => {
        let gitDir = this.getGitRoot(dir);
        return walkDir(gitDir, args.ide);
      }),
    );
    const files = results.flat().slice(-MAX_SUBMENU_ITEMS);
    const fileGroups = groupByLastNPathParts(files, 2);

    return files.map((file) => {
      const relativePath = this.normalizeRelativePath(file, this.getGitRoot(workspaceDirs[0]));
      return {
        id: file,
        title: getBasename(file),
        description: relativePath,
      };
    });
  }

  private getGitRoot(dir: string): string {
    if (this.gitRootCache[dir]) {
      return this.gitRootCache[dir];
    }

    try {
      const gitRoot = execSync("git rev-parse --show-toplevel", {
        cwd: dir,
        encoding: "utf-8",
      }).trim();
      this.gitRootCache[dir] = gitRoot;
      return gitRoot;
    } catch (error) {
      console.dir("Not a git repository or no git root found.");
      this.gitRootCache[dir] = dir;
      return dir;
    }
  }

  private normalizeRelativePath(path: string, gitRoot: string): string {
    const relativePath = path.replace(gitRoot, "").replace(/^[\/\\]/, "");
    return relativePath.replace(/\\/g, "/");
  }
}

export default RelativeGitFileContextProvider;
