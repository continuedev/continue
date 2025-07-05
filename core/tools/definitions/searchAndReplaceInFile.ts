import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface SearchAndReplaceInFileArgs {
  filepath: string;
  diff: string;
}

/**
 * This tool is in an experimental state.
 * Our starting point is heavily inspired by Cline's `replace_in_file` tool: https://github.com/cline/cline/blob/2709ccefcddc616e89a70962f017bcbbca1f17bf/src/core/prompts/system.ts#L87-L121
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
      "Request to replace sections of content in an existing file using SEARCH/REPLACE blocks that define exact changes to specific parts of the file. This tool should be used when you need to make targeted changes to specific parts of a file.",
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
\`\`\`

Critical rules:
1. SEARCH content must match the associated file section to find EXACTLY:
    * Match character-for-character including whitespace, indentation, line endings
    * Include all comments, docstrings, etc.
2. SEARCH/REPLACE blocks will ONLY replace the first match occurrence.
    * Including multiple unique SEARCH/REPLACE blocks if you need to make multiple changes.
    * Include *just* enough lines in each SEARCH section to uniquely match each set of lines that need to change.
    * When using multiple SEARCH/REPLACE blocks, list them in the order they appear in the file.
3. Keep SEARCH/REPLACE blocks concise:
    * Break large SEARCH/REPLACE blocks into a series of smaller blocks that each change a small portion of the file.
    * Include just the changing lines, and a few surrounding lines if needed for uniqueness.
    * Do not include long runs of unchanging lines in SEARCH/REPLACE blocks.
    * Each line must be complete. Never truncate lines mid-way through as this can cause matching failures.
4. Avoid extra tool calls:
    * When making multiple closely related edits to the same file, you should try to use multiple SEARCH/REPLACE blocks in a single tool call, rather than making multiple tool calls
    * If you need to make follow up edits or group your work into logical segments, it is okay to perform additional tool calls
    * DO NOT make back-to-back tool calls. Instead interleave with brief explanation of what each will do
5. Special operations:
    * To move code: Use two SEARCH/REPLACE blocks (one to delete from original + one to insert at new location)
    * To delete code: Use empty REPLACE section
    
Usage:
\`\`\`
------- SEARCH
[exact content to find]
=======
[new content to replace with]
+++++++ REPLACE

------- SEARCH
[exact content to find]
=======
[new content to replace with]
+++++++ REPLACE
  \`\`\`
`,
        },
      },
    },
  },
};
