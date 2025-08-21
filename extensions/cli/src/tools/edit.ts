import * as fs from "fs";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";

import { telemetryService } from "../telemetry/telemetryService.js";
import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";

import { Tool } from "./types.js";
import { generateDiff } from "./writeFile.js";

export interface EditArgs {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

// Track files that have been read in the current session
export const readFilesSet = new Set<string>();

export const editTool: Tool = {
  name: "Edit",
  displayName: "Edit",
  readonly: false,
  isBuiltIn: true,
  description: `Performs exact string replacements in files.


Usage:

- You must use your \`Read\` tool at least once in the conversation before
editing. This tool will error if you attempt an edit without reading the file.

- When editing text from Read tool output, ensure you preserve the exact
indentation (tabs/spaces) as it appears AFTER the line number prefix. The line
number prefix format is: spaces + line number + tab. Everything after that tab
is the actual file content to match. Never include any part of the line number
prefix in the old_string or new_string.

- ALWAYS prefer editing existing files in the codebase. NEVER write new files
unless explicitly required.

- Only use emojis if the user explicitly requests it. Avoid adding emojis to
files unless asked.

- The edit will FAIL if \`old_string\` is not unique in the file. Either provide
a larger string with more surrounding context to make it unique or use
\`replace_all\` to change every instance of \`old_string\`.

- Use \`replace_all\` for replacing and renaming strings across the file. This
parameter is useful if you want to rename a variable for instance.`,
  parameters: {
    file_path: {
      type: "string",
      description: "The absolute path to the file to modify",
      required: true,
    },
    old_string: {
      type: "string",
      description: "The text to replace",
      required: true,
    },
    new_string: {
      type: "string",
      description:
        "The text to replace it with (must be different from old_string)",
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
    throwIfFileIsSecurityConcern(file_path);
    // Check if file has been read
    if (!readFilesSet.has(file_path)) {
      throw new Error(
        `You must use the Read tool to read ${file_path} before editing it.`,
      );
    }

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

    // Check if file exists
    if (!fs.existsSync(file_path)) {
      throw new Error(`File ${file_path} does not exist`);
    }

    // Read current file content
    const oldContent = fs.readFileSync(file_path, "utf-8");

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
    const diff = generateDiff(oldContent, newContent, file_path);

    return {
      args: {
        file_path,
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
    file_path: string;
    newContent: string;
    oldContent: string;
  }) => {
    try {
      fs.writeFileSync(args.file_path, args.newContent, "utf-8");

      // Get lines for telemetry
      const { added, removed } = calculateLinesOfCodeDiff(
        args.oldContent,
        args.newContent,
      );
      const language = getLanguageFromFilePath(args.file_path);

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
        args.file_path,
      );

      return `Successfully edited ${args.file_path}\nDiff:\n${diff}`;
    } catch (error) {
      throw new Error(
        `Error: failed to edit ${args.file_path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};

// Function to mark a file as read (to be called from the read tool)
export function markFileAsRead(filePath: string) {
  readFilesSet.add(filePath);
}
