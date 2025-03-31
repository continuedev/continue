import { fileURLToPath } from "node:url";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class GitCommitContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "commit",
    displayTitle: "Commits",
    description: "Type to search",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const topLevelDir = fileURLToPath((await extras.ide.getWorkspaceDirs())[0]);
    try {
      if (query.includes("last ")) {
        return [
          {
            name: query,
            description: query,
            content: (
              await extras.ide.subprocess(
                `git --no-pager log --pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b" -p -n ${lastXCommitsDepth}`,
                topLevelDir,
              )
            )[0],
          },
        ];
      } else {
        return [
          {
            name: query,
            description: `commit ${query}`,
            content: (
              await extras.ide.subprocess(
                `git --no-pager show --pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b" ${query}`,
                topLevelDir,
              )
            )[0],
          },
        ];
      }
    } catch (err) {
      return [];
    }
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const depth = this.options?.Depth ?? 50;
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const topLevelDir = fileURLToPath((await args.ide.getWorkspaceDirs())[0]);
    try {
      const [gitResult] = await args.ide.subprocess(
        `git --no-pager log --pretty=format:"%H%x00%s" -n ${depth}`,
        topLevelDir,
      );
      const recentCommits = [
        {
          id: `last ${lastXCommitsDepth} commits`,
          title: `last ${lastXCommitsDepth} commits`,
          description: "recent commits",
        },
      ];
      const allCommits = gitResult
        .trim()
        .split("\n")
        .map((line) => {
          const [hash, message] = line.split("\0");
          return {
            id: hash,
            title: message,
            description: hash,
          };
        });
      return recentCommits.concat(allCommits);
    } catch (err: any) {
      //could be nice to toast the error eg. not a git repo or git is not installed
      return [];
    }
  }
}

export default GitCommitContextProvider;
