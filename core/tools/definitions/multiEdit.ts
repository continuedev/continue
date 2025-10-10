import { Tool } from "../..";
import { validateMultiEdit } from "../../edit/searchAndReplace/multiEditValidation";
import { executeMultiFindAndReplace } from "../../edit/searchAndReplace/performReplace";
import { validateSearchAndReplaceFilepath } from "../../edit/searchAndReplace/validateArgs";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { NO_PARALLEL_TOOL_CALLING_INSTRUCTION } from "./editFile";

export interface EditOperation {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface MultiEditArgs {
  filepath: string;
  edits: EditOperation[];
}

export const multiEditTool: Tool = {
  type: "function",
  displayTitle: "Multi Edit",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.MultiEdit,
    description: `Use this tool to make multiple edits to a single file in one operation. It allows you to perform multiple find-and-replace operations efficiently. 

To make multiple edits to a file, provide the following:
1. filepath: The path to the file to modify, RELATIVE to the project/workspace root (verify the directory path is correct)
2. edits: An array of edit operations to perform, where each edit contains:
   - old_string: The text to replace (must match the old file contents exactly, including all whitespace/indentation)
   - new_string: The edited text to replace the old_string
   - replace_all: Replace all occurrences of old_string. This parameter is optional and defaults to false.

IMPORTANT:
- Files may be modified between tool calls by users, linters, etc, so always make all edits in one tool call where possible. For example, do not only edit imports if there are other changes in the file, as unused imports may be removed by a linter between tool calls.
- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit, so plan your edits carefully to avoid conflicts between sequential operations
- Edits are atomic - all edits must be valid for the operation to succeed - if any edit fails, none will be applied
- The system validates the entire edit chain before applying any changes - you will receive a detailed error if edits conflict
- This tool is ideal when you need to make several changes to different parts of the same file

CRITICAL REQUIREMENTS:
1. ALWAYS use the ${BuiltInToolNames.ReadFile} tool just before making edits, to understand the file's up-to-date contents and context. The user can also edit the file while you are working with it.
2. ${NO_PARALLEL_TOOL_CALLING_INSTRUCTION}
3. When making edits:
- Ensure all edits result in idiomatic, correct code
- Do not leave the code in a broken state
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked
- Use replace_all for replacing and renaming all matches for a string across the file. This parameter is useful if you want to rename a variable, for instance

SEQUENTIAL EDIT PLANNING - HOW TO AVOID CONFLICTS:
The system validates that each edit will succeed AFTER previous edits are applied. If you get an error like "Edit N will fail: string not found after applying previous edits", you have two options:

Option 1 - Reorder edits: Edit non-overlapping parts first
  WRONG: [Edit 1: rename "data" to "user_data" (replace_all), Edit 2: change "process(data)" to "process_data(user_data)"]
  RIGHT: [Edit 1: change "process(data)" to "process_data(data)", Edit 2: rename "data" to "user_data" (replace_all)]

Option 2 - Update old_string to match state after previous edits
  WRONG: [Edit 1: change "rate = 0.1" to "tax_rate = 0.15", Edit 2: change "return rate" to "return tax_rate"]
  RIGHT: [Edit 1: change "rate = 0.1" to "tax_rate = 0.15", Edit 2: change "return rate" to "return tax_rate"]

Option 3 - Use replace_all strategically: For variable renames, use replace_all LAST
  Example: [Edit 1: update function body, Edit 2: rename variable with replace_all]

WARNINGS:
- If earlier edits modify text that later edits target, the system will detect and reject ALL edits before making changes
- The tool will fail if edits.old_string doesn't match the file contents exactly (including whitespace)
- The tool will fail if edits.old_string and edits.new_string are the same - they MUST be different
- For Python files, indentation must be preserved exactly - whitespace-insensitive matching is disabled`,
    parameters: {
      type: "object",
      required: ["filepath", "edits"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path to the file to modify, relative to the root of the workspace",
        },
        edits: {
          type: "array",
          description:
            "Array of edit operations to perform sequentially on the file",
          items: {
            type: "object",
            required: ["old_string", "new_string"],
            properties: {
              old_string: {
                type: "string",
                description:
                  "The text to replace (exact match including whitespace/indentation)",
              },
              new_string: {
                type: "string",
                description:
                  "The text to replace it with. MUST be different than old_string.",
              },
              replace_all: {
                type: "boolean",
                description:
                  "Replace all occurrences of old_string (default false) in the file",
              },
            },
          },
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To make multiple edits to a single file, use the ${BuiltInToolNames.MultiEdit} tool with a filepath (relative to the root of the workspace) and an array of edit operations.

  For example, you could respond with:`,
    exampleArgs: [
      ["filepath", "path/to/file.ts"],
      [
        "edits",
        `[
  { "old_string": "const oldVar = 'value'", "new_string": "const newVar = 'updated'" },
  { "old_string": "oldFunction()", "new_string": "newFunction()", "replace_all": true }
]`,
      ],
    ],
  },
  defaultToolPolicy: "allowedWithPermission",
  preprocessArgs: async (args, extras) => {
    const { edits } = validateMultiEdit(args);
    const fileUri = await validateSearchAndReplaceFilepath(
      args.filepath,
      extras.ide,
    );

    const editingFileContents = await extras.ide.readFile(fileUri);
    const newFileContents = executeMultiFindAndReplace(
      editingFileContents,
      edits,
      args.filepath as string,
    );

    return {
      ...args,
      fileUri,
      editingFileContents,
      newFileContents,
    };
  },
};
