import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class GreptileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "greptile",
    displayTitle: "Greptile",
    description: "Insert query to Greptile",
    type: "query",
  };

  get deprecationMessage() {
    return "The Greptile context provider is now deprecated and will be removed in a later version. Please consider viewing their docs at greptile.com/docs/code-review-bot/auto-resolve-with-mcp for resolving greptile queries.";
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const greptileToken = this.getGreptileToken();
    if (!greptileToken) {
      throw new Error("Greptile token not found.");
    }

    const githubToken = this.getGithubToken();
    if (!githubToken) {
      throw new Error("GitHub token not found.");
    }

    let absPath = await this.getWorkspaceDir(extras);
    if (!absPath) {
      throw new Error("Failed to determine the workspace directory.");
    }

    var remoteUrl = getRemoteUrl(absPath);
    remoteUrl = getRemoteUrl(absPath);
    const repoName = extractRepoName(remoteUrl);
    const branch = getCurrentBranch(absPath);
    const remoteType = getRemoteType(remoteUrl);

    if (!remoteType) {
      throw new Error("Unable to determine remote type.");
    }

    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${greptileToken}`,
        "X-GitHub-Token": githubToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ id: "<string>", content: query, role: "user" }],
        repositories: [
          {
            remote: remoteType,
            branch: branch,
            repository: repoName,
          },
        ],
        sessionId: extras.config.userToken || "default-session",
        stream: false,
        genius: true,
      }),
    };

    try {
      const response = await extras.fetch(
        "https://api.greptile.com/v2/query",
        options,
      );
      const rawText = await response.text();

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse the response as JSON
      try {
        const json = JSON.parse(rawText);
        return json.sources.map((source: any) => ({
          description: source.filepath,
          content: `File: ${source.filepath}\nLines: ${source.linestart}-${source.lineend}\n\n${source.summary}`,
          name:
            (source.filepath.split("/").pop() ?? "").split("\\").pop() ?? "",
        }));
      } catch (jsonError) {
        throw new Error(`Failed to parse Greptile response:\n${rawText}`);
      }
    } catch (error) {
      console.error("Error getting context items from Greptile:", error);
      throw new Error("Error getting context items from Greptile");
    }
  }

  private getGreptileToken(): string | undefined {
    return this.options.GreptileToken || process.env.GREPTILE_AUTH_TOKEN;
  }

  private getGithubToken(): string | undefined {
    return this.options.GithubToken || process.env.GITHUB_TOKEN;
  }

  private async getWorkspaceDir(
    extras: ContextProviderExtras,
  ): Promise<string | null> {
    try {
      const workspaceDirs = await extras.ide.getWorkspaceDirs();
      if (workspaceDirs && workspaceDirs.length > 0) {
        return workspaceDirs[0];
      } else {
        console.warn(
          "extras.ide.getWorkspaceDirs() returned undefined or empty array.",
        );
      }
    } catch (err) {
      console.warn(
        "Failed to get workspace directories from extras.ide.getWorkspaceDirs():",
      );
    }

    // Fallback to using Git commands
    try {
      const currentDir = process.cwd();
      if (this.isGitRepository(currentDir)) {
        const workspaceDir = execSync("git rev-parse --show-toplevel")
          .toString()
          .trim();
        return workspaceDir;
      } else {
        console.warn(
          `Current directory is not a Git repository: ${currentDir}`,
        );
        return null;
      }
    } catch (err) {
      console.warn("Failed to get workspace directory using Git commands: ");
      return null;
    }
  }

  private isGitRepository(dir: string): boolean {
    try {
      const gitDir = path.join(dir, ".git");
      return fs.existsSync(gitDir);
    } catch (err) {
      console.warn("Failed to check if directory is a Git repository:");
      return false;
    }
  }
}

// Helper functions
function getRemoteUrl(absPath: string): string {
  try {
    const remote = execSync(`git -C ${absPath} remote get-url origin`)
      .toString()
      .trim();
    return remote;
  } catch (err) {
    console.warn("Failed to get remote URL");
    return "";
  }
}

function getCurrentBranch(absPath: string): string {
  try {
    const branch = execSync(`git -C ${absPath} rev-parse --abbrev-ref HEAD`)
      .toString()
      .trim();
    return branch;
  } catch (err) {
    console.warn("Failed to get current branch");
    return "master"; // Default to 'master' if the current branch cannot be determined
  }
}

function extractRepoName(remote: string): string {
  if (remote.startsWith("http://") || remote.startsWith("https://")) {
    const parts = remote.split("/");
    if (parts.length >= 2) {
      return (
        parts[parts.length - 2] +
        "/" +
        parts[parts.length - 1].replace(".git", "")
      );
    }
  } else if (remote.startsWith("git@")) {
    const parts = remote.split(":");
    if (parts.length >= 2) {
      return parts[1].replace(".git", "");
    }
  }
  return "";
}

function getRemoteType(remote: string): string {
  if (remote.includes("github.com")) {
    return "github";
  } else if (remote.includes("gitlab.com")) {
    return "gitlab";
  } else if (remote.includes("azure.com")) {
    return "azure";
  }
  return "";
}

export default GreptileContextProvider;
