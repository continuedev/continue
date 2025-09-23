import { spawn } from "child_process";

import { env } from "../env.js";
import { getService, SERVICE_NAMES } from "../services/index.js";
import {
  AuthServiceState,
  StorageSyncServiceState,
} from "../services/types.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { formatError } from "../util/formatError.js";
import { logger } from "../util/logger.js";

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

// Helper function to get session creator information
async function getSessionCreator(
  sessionId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const url = new URL(`agents/${encodeURIComponent(sessionId)}`, env.apiBase);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      logger.debug(
        `Failed to get agent session: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();
    return data.metadata?.createdBySlug || null;
  } catch (error) {
    logger.debug(`Error fetching agent session: ${formatError(error)}`);
    return null;
  }
}

// Helper function to check if the PR tool should be available
async function isAgentSessionActive(): Promise<{
  isActive: boolean;
  sessionId?: string;
  accessToken?: string;
}> {
  try {
    const storageSyncState = await getService<StorageSyncServiceState>(
      SERVICE_NAMES.STORAGE_SYNC,
    );

    if (storageSyncState.isEnabled && storageSyncState.storageId) {
      // Get access token from auth service
      let accessToken: string | undefined;
      try {
        const authState = await getService<AuthServiceState>(
          SERVICE_NAMES.AUTH,
        );
        if (authState.authConfig?.accessToken) {
          accessToken = authState.authConfig.accessToken;
        }
      } catch (error) {
        logger.debug(`Failed to get access token: ${formatError(error)}`);
      }

      return {
        isActive: true,
        sessionId: storageSyncState.storageId,
        accessToken,
      };
    }

    return { isActive: false };
  } catch (error) {
    logger.debug(`Error checking agent session: ${formatError(error)}`);
    return { isActive: false };
  }
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
      // Check if this tool should be available (agent session active)
      const sessionInfo = await isAgentSessionActive();
      if (!sessionInfo.isActive || !sessionInfo.sessionId) {
        return "Error: PR tool is only available when running with an agent session ID (use the --id flag with 'cn serve').";
      }

      // Get current branch
      const currentBranch = await getCurrentBranch();

      // Try to get creator information if access token is available
      let creatorSlug = "unknown";
      if (sessionInfo.accessToken) {
        const creator = await getSessionCreator(
          sessionInfo.sessionId,
          sessionInfo.accessToken,
        );
        if (creator) {
          creatorSlug = creator;
        }
      }

      // Add agent session information
      const agentSessionUrl = `https://hub.continue.dev/agents/${sessionInfo.sessionId}`;
      const enhancedBody = `${body}\n\n---\n\nThis [agent session](${agentSessionUrl}) was created by ${creatorSlug} and co-authored by Continue <noreply@continue.dev>.`;

      // Build gh CLI arguments
      const args = [
        "pr",
        "create",
        "--head",
        currentBranch,
        "--title",
        title,
        "--body",
        enhancedBody,
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
