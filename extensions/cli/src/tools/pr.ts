import { spawn } from "child_process";

import { telemetryService } from "../telemetry/telemetryService.js";

import { Tool } from "./types.js";

// Helper function to get the current git branch
function getCurrentBranch(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["branch", "--show-current"]);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to get current branch: ${stderr.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.on("error", (error) => {
      reject(new Error(`Error getting current branch: ${error.message}`));
    });
  });
}

// Helper function to execute gh CLI command
function executeGhCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`gh command failed (exit code ${code}): ${stderr.trim()}`),
        );
        return;
      }
      resolve(stdout.trim());
    });

    child.on("error", (error) => {
      reject(new Error(`Error executing gh command: ${error.message}`));
    });
  });
}

export const prTool: Tool = {
  name: "PR",
  displayName: "Create Pull Request",
  description: `Creates a pull request using the GitHub CLI (gh). 

This tool will create a pull request from the current branch to the default branch (usually main/master). 
The GitHub CLI must be configured and authenticated for this to work.`,
  parameters: {
    type: "object",
    required: ["title", "body"],
    properties: {
      title: {
        type: "string",
        description: "The title of the pull request",
      },
      body: {
        type: "string",
        description: "The body/description of the pull request",
      },
      draft: {
        type: "boolean",
        description:
          "Whether to create the PR as a draft (optional, defaults to false)",
      },
    },
  },
  readonly: false,
  isBuiltIn: true,
  preprocess: async (args) => {
    const { title, body, draft } = args;

    if (!title || typeof title !== "string") {
      throw new Error("title is required and must be a non-empty string");
    }

    if (!body || typeof body !== "string") {
      throw new Error("body is required and must be a non-empty string");
    }

    let currentBranch: string;
    try {
      currentBranch = await getCurrentBranch();
    } catch (error) {
      throw new Error(
        `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const truncatedTitle =
      title.length > 50 ? title.substring(0, 50) + "..." : title;
    const draftText = draft ? " (as draft)" : "";

    return {
      args,
      preview: [
        {
          type: "text",
          content: `Will create PR from branch "${currentBranch}": ${truncatedTitle}${draftText}`,
        },
      ],
    };
  },
  run: async ({
    title,
    body,
    draft = false,
  }: {
    title: string;
    body: string;
    draft?: boolean;
  }): Promise<string> => {
    try {
      // Get current branch
      const currentBranch = await getCurrentBranch();

      // Build gh CLI arguments
      const args = [
        "pr",
        "create",
        "--head",
        currentBranch,
        "--title",
        title,
        "--body",
        body,
      ];

      if (draft) {
        args.push("--draft");
      }

      // Execute the gh command
      const output = await executeGhCommand(args);

      // Track successful PR creation
      telemetryService.recordPullRequestCreated();

      return `Successfully created pull request:\n${output}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Provide helpful error messages for common issues
      if (errorMessage.includes("not found") && errorMessage.includes("gh")) {
        return "Error: GitHub CLI (gh) is not installed or not found in PATH. Please install it from https://cli.github.com/";
      }

      if (
        errorMessage.includes("authentication") ||
        errorMessage.includes("auth")
      ) {
        return "Error: GitHub CLI is not authenticated. Please run 'gh auth login' first.";
      }

      if (errorMessage.includes("not a git repository")) {
        return "Error: Not in a git repository. Please navigate to a git repository first.";
      }

      throw new Error(errorMessage);
    }
  },
};
