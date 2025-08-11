import * as fs from "fs";
import * as path from "path";

import { telemetryService } from "../telemetry/telemetryService.js";
import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";

import { readFilesSet, markFileAsRead } from "./edit.js";
import { Tool } from "./types.js";
import { generateDiff } from "./writeFile.js";

export interface EditOperation {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface MultiEditArgs {
  file_path: string;
  edits: EditOperation[];
}

// Function to check if file has been read (shared with edit tool)
function hasFileBeenRead(filePath: string): boolean {
  return readFilesSet.has(filePath);
}

export const multiEditTool: Tool = {
  name: "MultiEdit",
  displayName: "MultiEdit",
  readonly: false,
  isBuiltIn: true,
  description: `This is a tool for making multiple edits to a single file in one operation. It
is built on top of the Edit tool and allows you to perform multiple
find-and-replace operations efficiently. Prefer this tool over the Edit tool
when you need to make multiple edits to the same file.


Before using this tool:


1. Use the Read tool to understand the file's contents and context

2. Verify the directory path is correct


To make multiple file edits, provide the following:

1. file_path: The absolute path to the file to modify (must be absolute, not
relative)

2. edits: An array of edit operations to perform, where each edit contains:
   - old_string: The text to replace (must match the file contents exactly, including all whitespace and indentation)
   - new_string: The edited text to replace the old_string
   - replace_all: Replace all occurences of old_string. This parameter is optional and defaults to false.

IMPORTANT:

- All edits are applied in sequence, in the order they are provided

- Each edit operates on the result of the previous edit

- All edits must be valid for the operation to succeed - if any edit fails,
none will be applied

- This tool is ideal when you need to make several changes to different parts
of the same file

- For Jupyter notebooks (.ipynb files), use the NotebookEdit instead


CRITICAL REQUIREMENTS:

1. All edits follow the same requirements as the single Edit tool

2. The edits are atomic - either all succeed or none are applied

3. Plan your edits carefully to avoid conflicts between sequential operations


WARNING:

- The tool will fail if edits.old_string doesn't match the file contents
exactly (including whitespace)

- The tool will fail if edits.old_string and edits.new_string are the same

- Since edits are applied in sequence, ensure that earlier edits don't affect
the text that later edits are trying to find


When making edits:

- Ensure all edits result in idiomatic, correct code

- Do not leave the code in a broken state

- Always use absolute file paths (starting with /)

- Only use emojis if the user explicitly requests it. Avoid adding emojis to
files unless asked.

- Use replace_all for replacing and renaming strings across the file. This
parameter is useful if you want to rename a variable for instance.


If you want to create a new file, use:

- A new file path, including dir name if needed

- First edit: empty old_string and the new file's contents as new_string

- Subsequent edits: normal edit operations on the created content`,
  parameters: {
    file_path: {
      type: "string",
      description: "The absolute path to the file to modify",
      required: true,
    },
    edits: {
      type: "array",
      description:
        "Array of edit operations to perform sequentially on the file",
      required: true,
    },
  },
  preprocess: async (args) => {
    const { file_path, edits } = args as MultiEditArgs;

    // Validate arguments
    if (!file_path) {
      throw new Error("file_path is required");
    }
    if (!path.isAbsolute(file_path)) {
      throw new Error("file_path must be an absolute path");
    }
    if (!edits || !Array.isArray(edits) || edits.length === 0) {
      throw new Error(
        "edits array is required and must contain at least one edit",
      );
    }

    // Validate each edit operation
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      if (!edit.old_string && edit.old_string !== "") {
        throw new Error(`Edit ${i + 1}: old_string is required`);
      }
      if (edit.new_string === undefined) {
        throw new Error(`Edit ${i + 1}: new_string is required`);
      }
      if (edit.old_string === edit.new_string) {
        throw new Error(
          `Edit ${i + 1}: old_string and new_string must be different`,
        );
      }
    }

    // Check if this is creating a new file (first edit has empty old_string)
    const isCreatingNewFile = edits[0].old_string === "";

    if (isCreatingNewFile) {
      // For new file creation, check if parent directory exists
      const parentDir = path.dirname(file_path);
      if (parentDir && !fs.existsSync(parentDir)) {
        throw new Error(`Parent directory does not exist: ${parentDir}`);
      }
      // Don't check if file has been read for new file creation
    } else {
      // For existing files, check if file has been read
      if (!hasFileBeenRead(file_path)) {
        throw new Error(
          `You must use the Read tool to read ${file_path} before editing it.`,
        );
      }

      // Check if file exists
      if (!fs.existsSync(file_path)) {
        throw new Error(`File ${file_path} does not exist`);
      }
    }

    // Read current file content (or start with empty for new files)
    let currentContent = "";
    if (!isCreatingNewFile) {
      currentContent = fs.readFileSync(file_path, "utf-8");
    }

    const originalContent = currentContent;
    let newContent = currentContent;

    // Apply all edits sequentially
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const { old_string, new_string, replace_all = false } = edit;

      // For new file creation, the first edit can have empty old_string
      if (i === 0 && isCreatingNewFile && old_string === "") {
        newContent = new_string;
        continue;
      }

      // Check if old_string exists in current content
      if (!newContent.includes(old_string)) {
        throw new Error(
          `Edit ${i + 1}: String not found in file: "${old_string}"`,
        );
      }

      if (replace_all) {
        // Replace all occurrences
        newContent = newContent.split(old_string).join(new_string);
      } else {
        // Replace only the first occurrence, but check for uniqueness
        const occurrences = newContent.split(old_string).length - 1;
        if (occurrences > 1) {
          throw new Error(
            `Edit ${i + 1}: String "${old_string}" appears ${occurrences} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
          );
        }
        newContent = newContent.replace(old_string, new_string);
      }
    }

    // Generate diff for preview
    const diff = generateDiff(originalContent, newContent, file_path);

    return {
      args: {
        file_path,
        newContent,
        originalContent,
        isCreatingNewFile,
        editCount: edits.length,
      },
      preview: [
        {
          type: "text",
          content: `Will apply ${edits.length} edit${edits.length === 1 ? "" : "s"} to ${isCreatingNewFile ? "create" : "modify"} ${file_path}:`,
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
    originalContent: string;
    isCreatingNewFile: boolean;
    editCount: number;
  }) => {
    try {
      fs.writeFileSync(args.file_path, args.newContent, "utf-8");

      // Get lines for telemetry
      const { added, removed } = calculateLinesOfCodeDiff(
        args.originalContent,
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

      const action = args.isCreatingNewFile ? "created" : "edited";
      return `Successfully ${action} ${args.file_path} with ${args.editCount} edit${args.editCount === 1 ? "" : "s"}`;
    } catch (error) {
      throw new Error(
        `Error: failed to edit ${args.file_path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
