import { createTwoFilesPatch } from "diff";
import * as fs from "fs";
import * as path from "path";
import { telemetryService } from "../telemetry.js";
import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";
import { Tool } from "./types.js";

function generateDiff(
  oldContent: string,
  newContent: string,
  filePath: string
): string {
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
      let oldContent = "";
      if (fs.existsSync(args.filepath)) {
        oldContent = fs.readFileSync(args.filepath, "utf-8");
      }

      // Write new content
      fs.writeFileSync(args.filepath, args.content, "utf-8");

      // Track lines of code changes if file existed before
      if (oldContent) {
        const { added, removed } = calculateLinesOfCodeDiff(
          oldContent,
          args.content
        );
        const language = getLanguageFromFilePath(args.filepath);

        if (added > 0) {
          telemetryService.recordLinesOfCodeModified("added", added, language);
        }
        if (removed > 0) {
          telemetryService.recordLinesOfCodeModified(
            "removed",
            removed,
            language
          );
        }

        const diff = generateDiff(oldContent, args.content, args.filepath);

        // Record file operation
        telemetryService.recordFileOperation(
          "write",
          "success",
          path.extname(args.filepath).substring(1) || "unknown"
        );

        return `Successfully wrote to file: ${args.filepath}\n\nDiff:\n${diff}`;
      } else {
        // New file creation - count all lines as added
        const lineCount = args.content.split("\n").length;
        const language = getLanguageFromFilePath(args.filepath);

        telemetryService.recordLinesOfCodeModified(
          "added",
          lineCount,
          language
        );

        // Record file operation
        telemetryService.recordFileOperation(
          "write",
          "success",
          path.extname(args.filepath).substring(1) || "unknown"
        );

        return `Successfully created file: ${args.filepath}`;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Record failed file operation
      telemetryService.recordFileOperation(
        "write",
        "error",
        path.extname(args.filepath).substring(1) || "unknown"
      );

      return `Error writing to file: ${errorMessage}`;
    }
  },
};
