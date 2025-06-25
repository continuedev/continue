import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface SearchAndReplaceInFileArgs {
  filepath: string;
  diff: string;
}

/**
 * Critical requirements:
1. SEARCH content must match the file section EXACTLY (character-for-character, including whitespace and indentation)
2. Each SEARCH/REPLACE block replaces only the first matching occurrence
3. For multiple changes, use multiple SEARCH/REPLACE blocks in file order
4. Keep blocks concise - include only the lines that need to change plus minimal context for uniqueness
5. To delete code, use an empty REPLACE section
6. To move code, use two blocks (one to delete, one to insert at new location)
 */

export const searchAndReplaceInFileTool: Tool = {
  type: "function",
  displayTitle: "Edit File",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.SearchAndReplaceInFile,
    description:
      "Use this tool to make precise modifications to existing files using SEARCH/REPLACE blocks. This tool is ideal for targeted changes to specific sections of a file.",
    parameters: {
      type: "object",
      required: ["filepath", "diff"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to modify, relative to the root of the workspace.",
        },
        diff: {
          type: "string",
          description: `One or more SEARCH/REPLACE blocks following this exact format:
\`\`\`
------- SEARCH
[exact content to find]
=======
[new content to replace with]
+++++++ REPLACE
\`\`\``,
        },
      },
    },
  },
};
