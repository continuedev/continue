import * as fs from "fs";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";
import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import { parseEnvNumber } from "../util/truncateOutput.js";

import { formatToolArgument } from "./formatters.js";
import { Tool, ToolRunContext } from "./types.js";

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

// Track files that have been read in the current session
export const readFilesSet = new Set<string>();
export function markFileAsRead(filePath: string) {
  readFilesSet.add(filePath);
}

export const readFileTool: Tool = {
  name: "Read",
  displayName: "Read",
  description: "Read the contents of a file at the specified path",
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
  ): Promise<string> => {
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
