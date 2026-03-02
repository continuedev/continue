import * as fs from "fs";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";
import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import {
  detectImageFormat,
  formatFileSize,
  isImageFile,
  processImageWithSharp,
} from "../util/image.js";
import { parseEnvNumber } from "../util/truncateOutput.js";

import { formatToolArgument } from "./formatters.js";
import { type MultipartToolResult, type ToolResult, Tool, ToolRunContext } from "./types.js";

// Output truncation defaults
const DEFAULT_READ_FILE_MAX_CHARS = 100000; // ~25k tokens
const DEFAULT_READ_FILE_MAX_LINES = 5000;

function getReadFileMaxChars(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_READ_FILE_MAX_OUTPUT_CHARS,
    DEFAULT_READ_FILE_MAX_CHARS,
  );
}

function getReadFileMaxLines(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_READ_FILE_MAX_OUTPUT_LINES,
    DEFAULT_READ_FILE_MAX_LINES,
  );
}

// Maximum image file size (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Track files that have been read in the current session
export const readFilesSet = new Set<string>();
export function markFileAsRead(filePath: string) {
  readFilesSet.add(filePath);
}

/**
 * Read an image file and return a multipart tool result with both
 * a text description and the base64-encoded image data.
 */
async function readImageFile(
  realPath: string,
  displayPath: string,
): Promise<MultipartToolResult> {
  const imageBuffer = fs.readFileSync(realPath);

  if (imageBuffer.length > MAX_IMAGE_SIZE) {
    throw new ContinueError(
      ContinueErrorReason.FileTooLarge,
      `Image file is too large: ${displayPath} (${formatFileSize(imageBuffer.length)}). ` +
        `Maximum allowed: ${formatFileSize(MAX_IMAGE_SIZE)}.`,
    );
  }

  // Process with Sharp if available (resize to fit model context)
  const { buffer: processedBuffer, isJpeg } =
    await processImageWithSharp(imageBuffer);

  const mimeType = isJpeg
    ? "image/jpeg"
    : detectImageFormat(processedBuffer);

  const base64Data = processedBuffer.toString("base64");

  return {
    type: "multipart",
    parts: [
      {
        type: "text",
        text: `Image file: ${displayPath} (${formatFileSize(imageBuffer.length)}, ${mimeType})`,
      },
      {
        type: "image",
        data: base64Data,
        mimeType,
      },
    ],
  };
}

export const readFileTool: Tool = {
  name: "Read",
  displayName: "Read",
  description:
    "Read the contents of a file at the specified path. Supports text files and images (png, jpg, gif, webp).",
  parameters: {
    type: "object",
    required: ["filepath"],
    properties: {
      filepath: {
        type: "string",
        description: "The path to the file to read",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    let { filepath } = args;
    if (filepath.startsWith("./")) {
      filepath = filepath.slice(2);
    }
    throwIfFileIsSecurityConcern(filepath);
    return {
      args,
      preview: [
        {
          type: "text",
          content: `Will read ${formatToolArgument(filepath)}`,
        },
      ],
    };
  },
  run: async (
    args: { filepath: string },
    context?: ToolRunContext,
  ): Promise<ToolResult> => {
    try {
      let { filepath } = args;
      if (filepath.startsWith("./")) {
        filepath = filepath.slice(2);
      }

      if (!fs.existsSync(filepath)) {
        throw new ContinueError(
          ContinueErrorReason.Unspecified,
          `File does not exist: ${filepath}`,
        );
      }
      const realPath = fs.realpathSync(filepath);

      // Handle image files
      if (isImageFile(filepath)) {
        return readImageFile(realPath, filepath);
      }

      const content = fs.readFileSync(realPath, "utf-8");

      // Divide limits by parallel tool call count to avoid context overflow
      const parallelCount = context?.parallelToolCallCount ?? 1;
      const baseMaxLines = getReadFileMaxLines();
      const baseMaxChars = getReadFileMaxChars();
      const maxLines = Math.floor(baseMaxLines / parallelCount);
      const maxChars = Math.floor(baseMaxChars / parallelCount);
      const lineCount = content.split("\n").length;
      const charCount = content.length;

      if (charCount > maxChars || lineCount > maxLines) {
        // Include note about single-tool limit when parallel calls reduce the limit
        const parallelNote =
          parallelCount > 1
            ? ` (Note: limit reduced due to ${parallelCount} parallel tool calls. Single-tool limit: ${baseMaxChars.toLocaleString()} characters or ${baseMaxLines.toLocaleString()} lines.)`
            : "";

        throw new ContinueError(
          ContinueErrorReason.FileTooLarge,
          `File is too large to read: ${filepath} (${charCount.toLocaleString()} characters, ${lineCount.toLocaleString()} lines). ` +
            `Maximum allowed: ${maxChars.toLocaleString()} characters or ${maxLines.toLocaleString()} lines.${parallelNote} ` +
            `Consider using terminal commands like 'head', 'tail', 'sed', or 'grep' to read targeted parts of the file.`,
        );
      }

      // Mark this file as read for the edit tool
      markFileAsRead(realPath);

      return `Content of ${filepath}:\n${content}`;
    } catch (error) {
      if (error instanceof ContinueError) {
        throw error;
      }
      throw new Error(
        `Error reading file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
