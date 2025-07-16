import * as fs from "fs";
import * as path from "path";
import { createTwoFilesPatch } from "diff";
import { Tool } from "./types.js";

function generateDiff(oldContent: string, newContent: string, filePath: string): string {
  return createTwoFilesPatch(
    filePath,
    filePath,
    oldContent,
    newContent,
    undefined,
    undefined,
    { context: 3 }
  );
}

export const writeFileTool: Tool = {
  name: "write_file",
  displayName: "Write",
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
  readonly: false,
  run: async (args: { filepath: string; content: string }): Promise<string> => {
    try {
      const dirPath = path.dirname(args.filepath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Read existing file content if it exists
      let oldContent = '';
      if (fs.existsSync(args.filepath)) {
        oldContent = fs.readFileSync(args.filepath, "utf-8");
      }

      // Write new content
      fs.writeFileSync(args.filepath, args.content, "utf-8");
      
      // Generate diff if file existed before
      if (oldContent) {
        const diff = generateDiff(oldContent, args.content, args.filepath);
        return `Successfully wrote to file: ${args.filepath}\n\nDiff:\n${diff}`;
      } else {
        return `Successfully created file: ${args.filepath}`;
      }
    } catch (error) {
      return `Error writing to file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};