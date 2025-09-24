import * as fs from "fs";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";

import { formatToolArgument } from "./formatters.js";
import { Tool } from "./types.js";

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
  run: async (args: { filepath: string }): Promise<string> => {
    try {
      let { filepath } = args;
      if (filepath.startsWith("./")) {
        filepath = filepath.slice(2);
      }

      if (!fs.existsSync(filepath)) {
        return `Error: File does not exist: ${filepath}`;
      }
      const realPath = fs.realpathSync(filepath);
      const content = fs.readFileSync(realPath, "utf-8");
      // Mark this file as read for the edit tool
      markFileAsRead(realPath);

      const lines = content.split("\n");
      if (lines.length > 5000) {
        const truncatedContent = lines.slice(0, 5000).join("\n");
        return `Content of ${filepath} (truncated to first 5000 lines of ${lines.length} total):\n${truncatedContent}`;
      }

      return `Content of ${filepath}:\n${content}`;
    } catch (error) {
      return `Error reading file: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  },
};
