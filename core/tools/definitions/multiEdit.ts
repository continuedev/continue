import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

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
    description: `This is a tool for making multiple edits to a single file in one operation. It
is built on top of the single find and replace tool and allows you to perform multiple
find-and-replace operations efficiently. Prefer this tool over the single find and replace tool
when you need to make multiple edits to the same file.

Before using this tool:

1. Use the read_file tool to understand the file's contents and context
2. Verify the directory path is correct

To make multiple file edits, provide the following:

1. filepath: The path to the file to modify (relative to the root of the workspace)
2. edits: An array of edit operations to perform, where each edit contains:
   - old_string: The text to replace (must match the file contents exactly, including all whitespace and indentation)
   - new_string: The edited text to replace the old_string
   - replace_all: Replace all occurrences of old_string. This parameter is optional and defaults to false.

IMPORTANT:
- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit
- All edits must be valid for the operation to succeed - if any edit fails,
none will be applied
- This tool is ideal when you need to make several changes to different parts
of the same file

CRITICAL REQUIREMENTS:

1. All edits follow the same requirements as the single find and replace tool
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
- Only use emojis if the user explicitly requests it. Avoid adding emojis to
files unless asked.
- Use replace_all for replacing and renaming strings across the file. This
parameter is useful if you want to rename a variable for instance.

If you want to create a new file, use:
- A new file path
- First edit: empty old_string and the new file's contents as new_string
- Subsequent edits are not allowed - there is no need since you are creating`,
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
                description: "The text to replace",
              },
              new_string: {
                type: "string",
                description: "The text to replace it with",
              },
              replace_all: {
                type: "boolean",
                description:
                  "Replace all occurrences of old_string (default false)",
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
};
