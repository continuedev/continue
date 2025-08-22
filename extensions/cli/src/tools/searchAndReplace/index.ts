import * as fs from "fs";

import { telemetryService } from "../../telemetry/telemetryService.js";
import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../../telemetry/utils.js";
import { Tool } from "../types.js";
import { generateDiff } from "../writeFile.js";

import { findSearchMatch } from "./findSearchMatch.js";
import { parseSearchAndReplaceArgs } from "./parseArgs.js";
import { parseAllSearchReplaceBlocks } from "./parseBlock.js";

export interface SearchAndReplaceInFileArgs {
  filepath: string;
  diffs: string[];
}

// Currently unsupported and filtered out in `gui/src/redux/slices/sessionSlice.ts`
export const NO_PARALLEL_TOOL_CALLING_INSRUCTION =
  "Note this tool CANNOT be called in parallel.";

/**
 * This tool is in an experimental state.
 * Our starting point is heavily inspired by Cline's `replace_in_file` tool: https://github.com/cline/cline/blob/2709ccefcddc616e89a70962f017bcbbca1f17bf/src/core/prompts/system.ts#L87-L121
 */
export const searchAndReplaceInFileTool: Tool = {
  name: "Edit",
  displayName: "Edit",
  readonly: false,
  isBuiltIn: true,
  description: `Request to replace sections of content in an existing file using multiple SEARCH/REPLACE blocks that define exact changes to specific parts of the file. This tool should be used when you need to make targeted changes to specific parts of a file. ${NO_PARALLEL_TOOL_CALLING_INSRUCTION}`,
  parameters: {
    filepath: {
      type: "string",
      description: "The path to the file to edit",
      required: true,
    },
    diffs: {
      type: "array",
      items: {
        type: "string",
      },
      description: `An array of strings, each containing one or more SEARCH/REPLACE blocks following this exact format:
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

Each string in the diffs array can contain multiple SEARCH/REPLACE blocks, and all will be applied sequentially in the order they appear.`,
      required: true,
    },
  },
  preprocess: async (args) => {
    // Get and validate args
    const { filepath, diffs } = parseSearchAndReplaceArgs(args);

    // Get current file contents
    if (!fs.existsSync(filepath)) {
      throw new Error(`file ${filepath} does not exist`);
    }
    const oldContent = fs.readFileSync(filepath, "utf-8");
    let newContent = oldContent;

    // Parse blocks
    const blocks = diffs.map(parseAllSearchReplaceBlocks).flat();
    if (blocks.length === 0) {
      throw new Error("No complete search/replace blocks found in any diffs");
    }

    // Apply all replacements sequentially to build the final content
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const { searchContent, replaceContent } = block;

      if (typeof searchContent === "undefined") {
        throw new Error(`No search content defined for block ${i + 1}`);
      }
      if (typeof replaceContent === "undefined") {
        throw new Error(`No replace content defined for block ${i + 1}`);
      }

      const match = findSearchMatch(newContent, searchContent);

      if (!match) {
        throw new Error(
          `Search content not found in block ${i + 1}:\n${searchContent}`,
        );
      }

      newContent =
        newContent.substring(0, match.startIndex) +
        replaceContent +
        newContent.substring(match.endIndex);
    }

    const diff = generateDiff(oldContent, newContent, filepath);

    return {
      args: {
        filepath,
        newContent,
        oldContent, // Just for telemetry later
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
  run: async (args) => {
    try {
      fs.writeFileSync(args.filepath, args.newContent, "utf-8");

      // Get lines for telemetry
      const { added, removed } = calculateLinesOfCodeDiff(
        args.oldContent,
        args.newContent,
      );
      const language = getLanguageFromFilePath(args.filepath);

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

      // Record file operation
      return `Successfully edited ${args.filepath}`;
    } catch (error) {
      throw new Error(
        `Error: failed to edit ${args.filepath}:\n ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
