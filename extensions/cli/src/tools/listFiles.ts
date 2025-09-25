import * as fs from "fs";
import * as path from "path";

import { formatToolArgument } from "./formatters.js";
import { Tool } from "./types.js";

// List files in a directory
export const listFilesTool: Tool = {
  name: "List",
  displayName: "List",
  description: "List files in a directory",
  parameters: {
    type: "object",
    required: ["dirpath"],
    properties: {
      dirpath: {
        type: "string",
        description: "The path to the directory to list",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    return {
      args,
      preview: [
        {
          type: "text",
          content: args.dirpath
            ? `Will list files in: ${formatToolArgument(args.dirpath)}`
            : "Will list files in current directory",
        },
      ],
    };
  },
  run: async (args: { dirpath: string }): Promise<string> => {
    try {
      if (!fs.existsSync(args.dirpath)) {
        return `Error: Directory does not exist: ${args.dirpath}`;
      }

      if (!fs.statSync(args.dirpath).isDirectory()) {
        return `Error: Path is not a directory: ${args.dirpath}`;
      }

      const files = fs.readdirSync(args.dirpath);
      const fileDetails = files.map((file) => {
        const fullPath = path.join(args.dirpath, file);
        const stats = fs.statSync(fullPath);
        const type = stats.isDirectory() ? "directory" : "file";
        const size = stats.isFile() ? `${stats.size} bytes` : "";
        return `${file} (${type}${size ? `, ${size}` : ""})`;
      });

      return `Files in ${args.dirpath}:\n${fileDetails.join("\n")}`;
    } catch (error) {
      return `Error listing files: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  },
};
