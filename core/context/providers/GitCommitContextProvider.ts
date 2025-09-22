import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

const runGitCommand = (args: string[], cwd: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // First argument is the command, rest are arguments
    const gitProcess = spawn("git", args, {
      cwd,
    });
    let stdout = "";
    let stderr = "";

    gitProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    gitProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    gitProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Git command failed: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
};

class GitCommitContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "commit",
    displayTitle: "Commits",
    description: "Type to search",
    type: "submenu",
  };

  get deprecationMessage() {
    return "The git commits context provider is now deprecated and may be removed in a later version. Please consider using the Git MCP (https://hub.continue.dev/docker/mcp-git) instead.";
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    if (typeof lastXCommitsDepth !== "number") {
      throw new Error("LastXCommitsDepth must be a number");
    }
    const topLevelDir = fileURLToPath((await extras.ide.getWorkspaceDirs())[0]);

    try {
      if (query.includes("last ")) {
        const content = await runGitCommand(
          [
            "--no-pager",
            "log",
            '--pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b"',
            "-p",
            "-n",
            lastXCommitsDepth.toString(),
          ],
          topLevelDir,
        );
        return [
          {
            name: query,
            description: query,
            content,
          },
        ];
      } else {
        const content = await runGitCommand(
          [
            "--no-pager",
            "show",
            '--pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b"',
            query,
          ],
          topLevelDir,
        );
        return [
          {
            name: query,
            description: `commit ${query}`,
            content,
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

    if (typeof depth !== "number") {
      throw new Error("Depth must be a number");
    }
    if (typeof lastXCommitsDepth !== "number") {
      throw new Error("LastXCommitsDepth must be a number");
    }

    const topLevelDir = fileURLToPath((await args.ide.getWorkspaceDirs())[0]);
    try {
      const gitResult = await runGitCommand(
        [
          "--no-pager",
          "log",
          '--pretty=format:"%H%x00%s"',
          `-n`,
          depth.toString(),
        ],
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
          let [hash, message] = line.split("\0");
          hash = hash.replace(/"/g, "");
          message = message.replace(/"/g, "");
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
