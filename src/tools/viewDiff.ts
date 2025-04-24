import * as child_process from "child_process";
import * as fs from "fs";
import * as util from "util";
import { Tool } from "./types.js";

const execPromise = util.promisify(child_process.exec);

export const viewDiffTool: Tool = {
  name: "view_diff",
  description: "View all uncommitted changes in the git repository",
  parameters: {
    path: {
      type: "string",
      description:
        "The path to the git repository (defaults to current directory)",
      required: false,
    },
  },
  run: async (args: { path?: string }): Promise<string> => {
    try {
      const repoPath = args.path || process.cwd();
      if (!fs.existsSync(repoPath)) {
        return `Error: Path does not exist: ${repoPath}`;
      }

      try {
        await execPromise("git rev-parse --is-inside-work-tree", {
          cwd: repoPath,
        });
      } catch (error) {
        return `Error: The specified path is not a git repository: ${repoPath}`;
      }

      const { stdout, stderr } = await execPromise("git diff", {
        cwd: repoPath,
      });

      if (stderr) {
        return `Error executing git diff: ${stderr}`;
      }

      if (!stdout.trim()) {
        return "No changes detected in the git repository.";
      }

      return `Git diff for repository at ${repoPath}:\n\n${stdout}`;
    } catch (error) {
      return `Error running git diff: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
