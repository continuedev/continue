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
      if (!fs.existsSync(args.filepath)) {
        return `Error: File does not exist: ${args.filepath}`;
      }
      const content = fs.readFileSync(args.filepath, "utf-8");
      // Mark this file as read for the edit tool
      markFileAsRead(args.filepath);
      return `Content of ${args.filepath}:\n${content}`;
    } catch (error) {
      return `Error reading file: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  },
};
