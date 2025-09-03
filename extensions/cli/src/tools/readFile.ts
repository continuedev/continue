import * as fs from "fs";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";

import { markFileAsRead } from "./edit.js";
import { formatToolArgument } from "./formatters.js";
import { Tool } from "./types.js";

export const readFileTool: Tool = {
  name: "Read",
  displayName: "Read",
  description: "Read the contents of a file at the specified path",
  parameters: {
    filepath: {
      type: "string",
      description: "The path to the file to read",
      required: true,
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    throwIfFileIsSecurityConcern(args.filepath);
    return {
      args,
      preview: [
        {
          type: "text",
          content: `Will read ${formatToolArgument(args.filepath)}`,
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
      const content = fs.readFileSync(filepath, "utf-8");
      // Mark this file as read for the edit tool
      markFileAsRead(filepath);

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
