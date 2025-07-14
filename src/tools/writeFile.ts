import * as fs from "fs";
import * as path from "path";
import { Tool } from "./types.js";

function generateDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  let diff = `--- ${filePath}\n+++ ${filePath}\n`;
  
  // Simple line-by-line diff
  const maxLines = Math.max(oldLines.length, newLines.length);
  let hunkStart = -1;
  let hunkOldCount = 0;
  let hunkNewCount = 0;
  let hunkLines: string[] = [];
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine !== newLine) {
      if (hunkStart === -1) {
        hunkStart = i;
      }
      
      if (i < oldLines.length) {
        hunkLines.push(`-${oldLine}`);
        hunkOldCount++;
      }
      if (i < newLines.length) {
        hunkLines.push(`+${newLine}`);
        hunkNewCount++;
      }
    } else {
      if (hunkStart !== -1) {
        // End of hunk
        diff += `@@ -${hunkStart + 1},${hunkOldCount} +${hunkStart + 1},${hunkNewCount} @@\n`;
        diff += hunkLines.join('\n') + '\n';
        hunkStart = -1;
        hunkOldCount = 0;
        hunkNewCount = 0;
        hunkLines = [];
      }
    }
  }
  
  // Handle final hunk
  if (hunkStart !== -1) {
    diff += `@@ -${hunkStart + 1},${hunkOldCount} +${hunkStart + 1},${hunkNewCount} @@\n`;
    diff += hunkLines.join('\n') + '\n';
  }
  
  return diff;
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
