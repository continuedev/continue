import * as fs from "fs";
import * as path from "path";
import { Tool } from "./types.js";

export const writeFileTool: Tool = {
  name: "write_file",
  description: "Write content to a file at the specified path",
  parameters: {
    filepath: {
      type: "string",
      description: "The path to the file to write",
      required: true,
    },
    content: {
      type: "string",
      description: "The content to write to the file",
      required: true,
    },
  },
  run: async (args: { filepath: string; content: string }): Promise<string> => {
    try {
      const dirPath = path.dirname(args.filepath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(args.filepath, args.content, "utf-8");
      return `Successfully wrote to file: ${args.filepath}`;
    } catch (error) {
      return `Error writing to file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
