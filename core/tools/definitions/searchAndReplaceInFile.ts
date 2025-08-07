import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface SearchAndReplaceInFileArgs {
  filepath: string;
  diffs: string[];
}

// Currently unsupported and filtered out in `gui/src/redux/slices/sessionSlice.ts`
export const NO_PARALLEL_TOOL_CALLING_INSRUCTION =
  "Note this tool CANNOT be called in parallel.";

const SEARCH_AND_REPLACE_EXAMPLE_BLOCK = `------- SEARCH
[exact content to find]
=======
[new content to replace with]
+++++++ REPLACE`;

const SEARCH_AND_REPLACE_RULES = `Critical rules:
1. SEARCH content must match the associated file section to find EXACTLY:
    * Match character-for-character including whitespace, indentation, line endings
    * Include all comments, docstrings, etc.
2. SEARCH/REPLACE blocks will ONLY replace the first match occurrence.
    * Including multiple unique SEARCH/REPLACE blocks if you need to make multiple changes.
    * Include *just* enough lines in each SEARCH section to uniquely match each set of lines that need to change.
    * When using multiple SEARCH/REPLACE blocks, list them in the order they appear in the file.
3. **Order matters**: DIFFs in the array should be ordered from top to bottom of the file to ensure correct application.
4. Keep SEARCH/REPLACE blocks concise:
    * Break large SEARCH/REPLACE blocks into a series of smaller blocks that each change a small portion of the file.
    * Include just the changing lines, and a few surrounding lines if needed for uniqueness.
    * Do not include long runs of unchanging lines in SEARCH/REPLACE blocks.
    * Each line must be complete. Never truncate lines mid-way through as this can cause matching failures.
5. Splitting up tool calls:
    * When making multiple closely related edits to the same file, you should try to use multiple SEARCH/REPLACE blocks in a single tool call, rather than making multiple separate tool calls
    * If you need to make follow up edits or group your work into logical segments, it is okay to perform additional tool calls
    * DO NOT make back-to-back tool calls. Instead interleave with brief explanation of what each will do. For example, instead of [explanation, tool call, tool call] you should do [explanation, tool call, explanation, tool call]
6. Special operations:
    * To move code: Use two SEARCH/REPLACE blocks (one to delete from original + one to insert at new location)
    * To delete code: Use empty REPLACE section
7. You should always read the file before trying to edit it, to ensure you know the up-to-date file contents`;

const SEARCH_AND_REPLACE_DIFFS_DESCRIPTION = `An array of strings, each containing one or more SEARCH/REPLACE blocks following this exact format:
\`\`\`
${SEARCH_AND_REPLACE_EXAMPLE_BLOCK}
\`\`\`

${SEARCH_AND_REPLACE_RULES}
    
Usage:
\`\`\`
${SEARCH_AND_REPLACE_EXAMPLE_BLOCK}

${SEARCH_AND_REPLACE_EXAMPLE_BLOCK}
\`\`\`

Each string in the diffs array can contain multiple SEARCH/REPLACE blocks, and all will be applied sequentially in the order they appear.`;

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
    description: `Request to replace sections of content in an existing file using multiple SEARCH/REPLACE blocks that define exact changes to specific parts of the file. This tool should be used when you need to make targeted changes to specific parts of a file. ${NO_PARALLEL_TOOL_CALLING_INSRUCTION}`,
    parameters: {
      type: "object",
      required: ["filepath", "diffs"],
      properties: {
        filepath: {
          type: "string",
          description: `The path of the file to modify, relative to the root of the workspace.`,
        },
        diffs: {
          type: "array",
          items: {
            type: "string",
          },
          description: SEARCH_AND_REPLACE_DIFFS_DESCRIPTION,
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To make targeted edits by replacing sections of content in an existing file, use the ${BuiltInToolNames.SearchAndReplaceInFile} tool with a filepath (relative to the root of the workspace) and a "diffs" argument containing an array of SEARCH/REPLACE blocks that define exact changes to specific parts of the file.
Each block should follow this format:
${SEARCH_AND_REPLACE_EXAMPLE_BLOCK}

${SEARCH_AND_REPLACE_RULES}

  For example, you could respond with:`,
    exampleArgs: [
      ["filepath", "path/to/file.ts"],
      [
        "diffs",
        `[
"${SEARCH_AND_REPLACE_EXAMPLE_BLOCK}",
"${SEARCH_AND_REPLACE_EXAMPLE_BLOCK}"
]`,
      ],
    ],
  },
  defaultToolPolicy: "allowedWithPermission",
};
