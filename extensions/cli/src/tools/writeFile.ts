import * as fs from "fs";
import * as path from "path";

import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { createTwoFilesPatch } from "diff";

import { telemetryService } from "../telemetry/telemetryService.js";
import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";

import { Tool, ToolCallPreview } from "./types.js";

export function generateDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  return createTwoFilesPatch(
    filePath,
    filePath,
    oldContent,
    newContent,
    undefined,
    undefined,
    { context: 3 },
  );
}

export const writeFileTool: Tool = {
  name: "Write",
  displayName: "Write",
  description: "Write content to a file at the specified path",
  parameters: {
    type: "object",
    required: ["filepath", "content"],
    properties: {
      filepath: {
        type: "string",
        description: "The path to the file to write",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
  },
  readonly: false,
  isBuiltIn: true,
  preprocess: async (args) => {
    const filepath = args?.filepath;
    const content = args?.content ?? "";
    if (typeof filepath !== "string") {
      throw new Error("Filepath must be a string");
    }
    if (typeof content !== "string") {
      throw new Error("New file content must be a string");
    }
    try {
      if (fs.existsSync(filepath)) {
        const oldContent = fs.readFileSync(filepath, "utf-8");

        const diff = createTwoFilesPatch(
          args.filepath,
          args.filepath,
          oldContent,
          content,
          undefined,
          undefined,
          { context: 2 },
        );

        return {
          args,
          preview: [
            {
              type: "text",
              content: "Preview of changes:",
            },
            {
              type: "diff",
              content: diff,
            },
          ],
        };
      }
    } catch {
      // do nothing
    }
    const lines: string[] = content.split("\n");
    const previewLines = lines.slice(0, 3);

    const preview: ToolCallPreview[] = [
      {
        type: "text",
        content: "New file content:",
      },
      ...previewLines.map((line) => ({
        type: "text" as const,
        content: line || " ",
        paddingLeft: 2,
      })),
    ];
    if (lines.length > 3) {
      preview.push({
        type: "text",
        content: `... (${lines.length - 3} more lines)`,
      });
    }

    return {
      args: {
        filepath,
        content,
      },
      preview,
    };
  },
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
          args.content,
        );
        const language = getLanguageFromFilePath(args.filepath);

        if (added > 0) {
          telemetryService.recordLinesOfCodeModified("added", added, language);
        }
        if (removed > 0) {
          telemetryService.recordLinesOfCodeModified(
            "removed",
            removed,
            language,
          );
        }

        // Generate diff for result display
        const diff = generateDiff(oldContent, args.content, args.filepath);

        return `Successfully wrote to file: ${args.filepath}\nDiff:\n${diff}`;
      } else {
        // New file creation - count all lines as added
        const lineCount = args.content.split("\n").length;
        const language = getLanguageFromFilePath(args.filepath);

        telemetryService.recordLinesOfCodeModified(
          "added",
          lineCount,
          language,
        );

        return `Successfully created file: ${args.filepath}`;
      }
    } catch (error) {
      if (error instanceof ContinueError) {
        throw error;
      }
      throw new ContinueError(
        ContinueErrorReason.FileWriteError,
        `Error writing to file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
