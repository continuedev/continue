import * as fs from "fs";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";

import { telemetryService } from "../telemetry/telemetryService.js";
import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";

import { readFilesSet, readFileTool } from "./readFile.js";
import { Tool } from "./types.js";
import { generateDiff } from "./writeFile.js";

export interface EditArgs {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export const editTool: Tool = {
  name: "Edit",
  displayName: "Edit",
  readonly: false,
  isBuiltIn: true,
  description: `Performs exact string replacements in a file.

USAGE: 
- ALWAYS use the \`${readFileTool.name}\` tool just before making edits, to understand the file's up-to-date contents and context.
- When editing text from ${readFileTool.name} tool output, ensure you preserve exact whitespace/indentation.
- Always prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable, for instance.

WARNINGS:
- When not using \`replace_all\`, the edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- The edit will FAIL if you have not recently used the \`${readFileTool.name}\` tool to view up-to-date file contents.`,
  parameters: {
    file_path: {
      type: "string",
      description: "The absolute path to the file to modify",
      required: true,
    },
    old_string: {
      type: "string",
      description:
        "The text to replace - must be exact including whitespace/indentation",
      required: true,
    },
    new_string: {
      type: "string",
      description:
        "The text to replace it with (MUST be different from old_string)",
      required: true,
    },
    replace_all: {
      type: "boolean",
      description: "Replace all occurences of old_string (default false)",
      required: false,
    },
  },
  preprocess: async (args) => {
    const {
      file_path,
      old_string,
      new_string,
      replace_all = false,
    } = args as EditArgs;

    // Validate arguments
    if (!file_path) {
      throw new Error("file_path is required");
    }

    if (!old_string) {
      throw new Error("old_string is required");
    }
    if (new_string === undefined) {
      throw new Error("new_string is required");
    }
    if (old_string === new_string) {
      throw new Error("old_string and new_string must be different");
    }

    const resolvedPath = fs.realpathSync(file_path);

    // Check if file has been read
    if (!readFilesSet.has(resolvedPath)) {
      throw new Error(
        `You must use the ${readFileTool.name} tool to read ${file_path} before editing it.`,
      );
    }

    throwIfFileIsSecurityConcern(resolvedPath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File ${file_path} does not exist`);
    }

    // Read current file content
    const oldContent = fs.readFileSync(resolvedPath, "utf-8");

    // Check if old_string exists in the file
    if (!oldContent.includes(old_string)) {
      throw new Error(`String not found in file: ${old_string}`);
    }

    let newContent: string;

    if (replace_all) {
      // Replace all occurrences
      newContent = oldContent.split(old_string).join(new_string);
    } else {
      // Replace only the first occurrence
      const occurrences = oldContent.split(old_string).length - 1;
      if (occurrences > 1) {
        throw new Error(
          `String "${old_string}" appears ${occurrences} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
        );
      }
      newContent = oldContent.replace(old_string, new_string);
    }

    // Generate diff for preview
    const diff = generateDiff(oldContent, newContent, resolvedPath);

    return {
      args: {
        resolvedPath,
        newContent,
        oldContent,
      },
      preview: [
        {
          type: "text",
          content: "Will make the following changes:",
        },
        {
          type: "diff",
          content: diff,
        },
      ],
    };
  },
  run: async (args: {
    resolvedPath: string;
    newContent: string;
    oldContent: string;
  }) => {
    try {
      fs.writeFileSync(args.resolvedPath, args.newContent, "utf-8");

      // Get lines for telemetry
      const { added, removed } = calculateLinesOfCodeDiff(
        args.oldContent,
        args.newContent,
      );
      const language = getLanguageFromFilePath(args.resolvedPath);

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
      const diff = generateDiff(
        args.oldContent,
        args.newContent,
        args.resolvedPath,
      );

      return `Successfully edited ${args.resolvedPath}\nDiff:\n${diff}`;
    } catch (error) {
      throw new Error(
        `Error: failed to edit ${args.resolvedPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
