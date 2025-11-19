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
    // Resolve relative paths
    const normalizedPath = path.normalize(args.dirpath);
    const dirPath = path.resolve(process.cwd(), normalizedPath);

    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    if (!fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Error: Path is not a directory: ${dirPath}`);
    }

    return {
      args: {
        dirpath: dirPath,
      },
      preview: [
        {
          type: "text",
          content: dirPath
            ? `Will list files in: ${formatToolArgument(dirPath)}`
            : "Will list files in current directory",
        },
      ],
    };
  },
  run: async (args: { dirpath: string }): Promise<string> => {
    try {
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
      throw new Error(
        `Error listing files: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
