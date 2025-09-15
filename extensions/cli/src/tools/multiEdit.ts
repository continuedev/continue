import * as fs from "fs";
import * as path from "path";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";

import { telemetryService } from "../telemetry/telemetryService.js";
import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";

import { editTool } from "./edit.js";
import { readFilesSet, readFileTool } from "./readFile.js";
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

// Helper functions for multiEdit validation
function validateMultiEditArgs(args: any): {
  original_path: string;
  resolved_path: string;
  edits: EditOperation[];
} {
  const { file_path, edits } = args as MultiEditArgs;

  if (!file_path) {
    throw new Error("file_path is required");
  }
  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    throw new Error(
      "edits array is required and must contain at least one edit",
    );
  }

  // Convert relative paths to absolute paths
  const absolutePath = path.isAbsolute(file_path)
    ? file_path
    : path.resolve(process.cwd(), file_path);

  const resolvedPath = fs.realpathSync(absolutePath);

  return { original_path: file_path, resolved_path: resolvedPath, edits };
}

function validateEdits(edits: EditOperation[]): void {
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
}

function validateFileAccess(
  resolvedPath: string,
  isCreatingNewFile: boolean,
): void {
  if (isCreatingNewFile) {
    // For new file creation, check if parent directory exists
    const parentDir = path.dirname(resolvedPath);
    if (parentDir && !fs.existsSync(parentDir)) {
      throw new Error(`Parent directory does not exist: ${parentDir}`);
    }
  } else {
    // For existing files, check if file has been read
    // Check with the original path first, then with absolute path
    if (!readFilesSet.has(resolvedPath)) {
      throw new Error(
        `You must use the ${readFileTool.name} tool to read ${resolvedPath} before editing it.`,
      );
    }
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File ${resolvedPath} does not exist`);
    }
  }
}

function applyEdit(
  content: string,
  edit: EditOperation,
  editIndex: number,
  isFirstEditOfNewFile: boolean,
): string {
  const { old_string, new_string, replace_all = false } = edit;

  // For new file creation, the first edit can have empty old_string
  if (isFirstEditOfNewFile && old_string === "") {
    return new_string;
  }

  // Check if old_string exists in current content
  if (!content.includes(old_string)) {
    throw new Error(
      `Edit ${editIndex + 1}: String not found in file: "${old_string}"`,
    );
  }

  if (replace_all) {
    // Replace all occurrences
    return content.split(old_string).join(new_string);
  } else {
    // Replace only the first occurrence, but check for uniqueness
    const occurrences = content.split(old_string).length - 1;
    if (occurrences > 1) {
      throw new Error(
        `Edit ${editIndex + 1}: String "${old_string}" appears ${occurrences} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
      );
    }
    return content.replace(old_string, new_string);
  }
}

export const multiEditTool: Tool = {
  name: "MultiEdit",
  displayName: "MultiEdit",
  readonly: false,
  isBuiltIn: true,
  description: `This is a tool for making multiple edits to a single file in one operation. It is built on top of the ${editTool.name} tool and allows you to perform multiple find-and-replace operations efficiently.
Prefer this tool over the ${editTool.name} tool when you need to make multiple edits to the same file.

To make multiple edits to a file, provide the following:
1. file_path: The absolute path to the file to modify (must be absolute, not relative)
2. edits: An array of edit operations to perform, where each edit contains:
   - old_string: The text to replace (must match the file contents exactly, including all whitespace/indentation)
   - new_string: The edited text to replace the old_string
   - replace_all: Replace all occurences of old_string. This parameter is optional and defaults to false.

IMPORTANT:
- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit, so plan your edits carefully to avoid conflicts between sequential operations
- Edits are atomic - all edits must be valid for the operation to succeed - if any edit fails, none will be applied
- This tool is ideal when you need to make several changes to different parts of the same file

CRITICAL REQUIREMENTS:
1. ALWAYS use the ${readFileTool.name} tool just before making edits, to understand the file's up-to-date contents and context
2. When making edits:
- Ensure all edits result in idiomatic, correct code
- Do not leave the code in a broken state
- Always use absolute file paths (starting with /)
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use replace_all for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.

If you want to create a new file, use:
- A new file path, including new directory if needed
- First edit: empty old_string and the new file's contents as new_string
- Subsequent edits: normal edit operations on the created content
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required

WARNINGS:
- If earlier edits affect the text that later edits are trying to find, files can become mangled
- The tool will fail if edits.old_string doesn't match the file contents exactly (including whitespace)
- The tool will fail if edits.old_string and edits.new_string are the same - they MUST be different
- The tool will fail if you have not used the ${readFileTool.name} tool to read the file in this session`,
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
      items: {
        type: "object",
      },
    },
  },
  preprocess: async (args) => {
    // Validate and extract arguments
    const { resolved_path, edits } = validateMultiEditArgs(args);

    throwIfFileIsSecurityConcern(resolved_path);

    // Validate each edit operation
    validateEdits(edits);

    // Check if this is creating a new file (first edit has empty old_string)
    const isCreatingNewFile = edits[0].old_string === "";

    // Validate file access
    validateFileAccess(resolved_path, isCreatingNewFile);

    // Read current file content (or start with empty for new files)
    let currentContent = "";
    if (!isCreatingNewFile) {
      currentContent = fs.readFileSync(resolved_path, "utf-8");
    }

    const originalContent = currentContent;
    let newContent = currentContent;

    // Apply all edits sequentially
    for (let i = 0; i < edits.length; i++) {
      const isFirstEditOfNewFile = i === 0 && isCreatingNewFile;
      newContent = applyEdit(newContent, edits[i], i, isFirstEditOfNewFile);
    }

    // Generate diff for preview
    const diff = generateDiff(originalContent, newContent, resolved_path);

    return {
      args: {
        file_path: resolved_path,
        newContent,
        originalContent,
        isCreatingNewFile,
        editCount: edits.length,
      },
      preview: [
        {
          type: "text",
          content: `Will apply ${edits.length} edit${edits.length === 1 ? "" : "s"} to ${isCreatingNewFile ? "create" : "modify"} ${resolved_path}:`,
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

      // Generate diff for result display
      const diff = generateDiff(
        args.originalContent,
        args.newContent,
        args.file_path,
      );

      const action = args.isCreatingNewFile ? "created" : "edited";
      return `Successfully ${action} ${args.file_path} with ${args.editCount} edit${args.editCount === 1 ? "" : "s"}\nDiff:\n${diff}`;
    } catch (error) {
      throw new Error(
        `Error: failed to edit ${args.file_path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
