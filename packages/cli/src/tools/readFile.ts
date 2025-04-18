import * as fs from "fs";
import { Tool } from "./types.js";

export const readFileTool: Tool = {
  name: "read_file",
  description: "Read the contents of a file at the specified path",
  parameters: {
    filepath: {
      type: "string",
      description: "The path to the file to read",
      required: true,
    },
  },
  run: async (args: { filepath: string }): Promise<string> => {
    try {
      if (!fs.existsSync(args.filepath)) {
        return `Error: File does not exist: ${args.filepath}`;
      }
      const content = fs.readFileSync(args.filepath, "utf-8");
      return `Content of ${args.filepath}:\n${content}`;
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
