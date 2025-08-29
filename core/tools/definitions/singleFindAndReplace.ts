import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { NO_PARALLEL_TOOL_CALLING_INTSRUCTION } from "./editFile";

export interface SingleFindAndReplaceArgs {
  filepath: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export const singleFindAndReplaceTool: Tool = {
  type: "function",
  displayTitle: "Find and Replace",
  wouldLikeTo: "find and replace in {{{ filepath }}}",
  isCurrently: "finding and replacing in {{{ filepath }}}",
  hasAlready: "found and replaced in {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.SingleFindAndReplace,
    description: `Performs exact string replacements in files.

Usage:

- You must use your \`read_file\` tool at least once in the conversation before
editing. This tool will error if you attempt an edit without reading the file.

- When editing text from read_file tool output, ensure you preserve the exact
indentation (tabs/spaces) as it appears AFTER the line number prefix. The line
number prefix format is: spaces + line number + tab. Everything after that tab
is the actual file content to match. Never include any part of the line number
prefix in the old_string or new_string.

- ALWAYS prefer editing existing files in the codebase. NEVER write new files
unless explicitly required.

- Only use emojis if the user explicitly requests it. Avoid adding emojis to
files unless asked.

- ${NO_PARALLEL_TOOL_CALLING_INTSRUCTION}

- The edit will FAIL if \`old_string\` is not unique in the file. Either provide
a larger string with more surrounding context to make it unique or use
\`replace_all\` to change every instance of \`old_string\`.

- Use \`replace_all\` for replacing and renaming strings across the file. This
parameter is useful if you want to rename a variable for instance.`,
    parameters: {
      type: "object",
      required: ["filepath", "old_string", "new_string"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path to the file to modify, relative to the root of the workspace",
        },
        old_string: {
          type: "string",
          description: "The text to replace",
        },
        new_string: {
          type: "string",
          description:
            "The text to replace it with (must be different from old_string)",
        },
        replace_all: {
          type: "boolean",
          description: "Replace all occurrences of old_string (default false)",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To perform exact string replacements in files, use the ${BuiltInToolNames.SingleFindAndReplace} tool with a filepath (relative to the root of the workspace) and the strings to find and replace.

  For example, you could respond with:`,
    exampleArgs: [
      ["filepath", "path/to/file.ts"],
      ["old_string", "const oldVariable = 'value'"],
      ["new_string", "const newVariable = 'updated'"],
      ["replace_all", "false"],
    ],
  },
  defaultToolPolicy: "allowedWithPermission",
};
