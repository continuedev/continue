import * as fs from "fs";
import * as path from "path";

import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import { getAccessToken, loadAuthConfig } from "../auth/workos.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

/**
 * Extract the agent ID from the --id command line flag
 */
function getAgentIdFromArgs(): string | undefined {
  const args = process.argv;
  const idIndex = args.indexOf("--id");
  if (idIndex !== -1 && idIndex + 1 < args.length) {
    return args[idIndex + 1];
  }
  return undefined;
}

export const uploadArtifactTool: Tool = {
  name: "UploadArtifact",
  displayName: "Upload Artifact",
  description:
    "Upload a file (screenshot, video, log) to the session artifacts for user review. Supported formats: images (png, jpg, jpeg, gif, webp), videos (mp4, mov, avi, webm), and text files. Maximum file size: 50MB. If an artifact with the same filename already exists, it will be overwritten with the new file.",
  parameters: {
    type: "object",
    required: ["filePath"],
    properties: {
      filePath: {
        type: "string",
        description:
          "Absolute path to the file to upload (e.g., /tmp/screenshot.png)",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async (args: { filePath: string }): Promise<string> => {
    try {
      // Import services here to avoid circular dependency
      // services/index.ts -> ToolPermissionService -> allBuiltIns -> uploadArtifact -> services/index.ts
      const { services } = await import("../services/index.js");

      const trimmedPath = args.filePath?.trim();
      if (!trimmedPath) {
        throw new ContinueError(
          ContinueErrorReason.Unspecified,
          "filePath is required to upload an artifact.",
        );
      }

      // Get agent session ID
      const agentId = getAgentIdFromArgs();
      if (!agentId) {
        throw new ContinueError(
          ContinueErrorReason.Unspecified,
          "Agent ID is required. This tool only works with 'cn serve --id <agentId>'.",
        );
      }

      // Get access token
      const authConfig = loadAuthConfig();
      const accessToken = getAccessToken(authConfig);
      if (!accessToken) {
        throw new ContinueError(
          ContinueErrorReason.Unspecified,
          "Authentication required. Please log in with 'cn login'.",
        );
      }

      // Validate file exists
      if (!fs.existsSync(trimmedPath)) {
        throw new ContinueError(
          ContinueErrorReason.Unspecified,
          `File not found: ${trimmedPath}`,
        );
      }

      // Get file stats for logging
      const stats = fs.statSync(trimmedPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const filename = path.basename(trimmedPath);

      logger.info(`Uploading artifact: ${filename} (${fileSizeMB} MB)`);

      // Upload the artifact
      const result = await services.artifactUpload.uploadArtifact({
        agentSessionId: agentId,
        filePath: trimmedPath,
        accessToken,
      });

      if (result.success) {
        logger.info(`Successfully uploaded artifact: ${result.filename}`);
        return `Artifact uploaded successfully: ${result.filename} (${fileSizeMB} MB). The user can view it in the Artifacts tab of the session.`;
      } else {
        // Handle specific error cases with helpful messages
        const errorMsg = result.error || "Unknown error";

        if (errorMsg.includes("File size exceeds")) {
          throw new ContinueError(
            ContinueErrorReason.Unspecified,
            `File is too large (${fileSizeMB} MB). Maximum allowed size is 50MB. Consider compressing the file or splitting it into smaller parts.`,
          );
        } else if (errorMsg.includes("Storage limit exceeded")) {
          throw new ContinueError(
            ContinueErrorReason.Unspecified,
            "Session storage limit exceeded (500MB total). The user may need to delete old artifacts or you may need to reduce the number of uploads.",
          );
        } else if (
          errorMsg.includes("not allowed") ||
          errorMsg.includes("extension")
        ) {
          throw new ContinueError(
            ContinueErrorReason.Unspecified,
            `File type not supported. Only images (png, jpg, jpeg, gif, webp), videos (mp4, mov, avi, webm), and text files (log, txt, json, xml, csv, html) are allowed.`,
          );
        } else {
          throw new ContinueError(
            ContinueErrorReason.Unspecified,
            `Failed to upload artifact: ${errorMsg}`,
          );
        }
      }
    } catch (error) {
      if (error instanceof ContinueError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error uploading artifact: ${errorMessage}`);
      throw new ContinueError(
        ContinueErrorReason.Unspecified,
        `Error uploading artifact: ${errorMessage}`,
      );
    }
  },
};
