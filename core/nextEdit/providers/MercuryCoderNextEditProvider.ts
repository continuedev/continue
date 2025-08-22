import { HelperVars } from "../../autocomplete/util/HelperVars.js";
import { NEXT_EDIT_MODELS } from "../../llm/constants.js";
import {
  MERCURY_CURRENT_FILE_CONTENT_CLOSE,
  MERCURY_CURRENT_FILE_CONTENT_OPEN,
  MERCURY_EDIT_DIFF_HISTORY_CLOSE,
  MERCURY_EDIT_DIFF_HISTORY_OPEN,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN,
  MERCURY_SYSTEM_PROMPT,
  UNIQUE_TOKEN,
} from "../constants.js";
import {
  currentFileContentBlock,
  editHistoryBlock,
  recentlyViewedCodeSnippetsBlock,
} from "../templating/mercuryCoderNextEdit.js";
import { ModelSpecificContext, Prompt } from "../types.js";
import { BaseNextEditProvider } from "./BaseNextEditProvider.js";

export class MercuryCoderProvider extends BaseNextEditProvider {
  constructor() {
    super(NEXT_EDIT_MODELS.MERCURY_CODER);
  }

  getSystemPrompt(): string {
    return MERCURY_SYSTEM_PROMPT;
  }

  getWindowSize() {
    return { topMargin: 0, bottomMargin: 5 };
  }

  shouldInjectUniqueToken(): boolean {
    return true;
  }

  getUniqueToken(): string {
    return UNIQUE_TOKEN;
  }

  extractCompletion(message: string): string {
    // Extract the code between the markdown code blocks.
    return message.slice(
      message.indexOf("```\n") + "```\n".length,
      message.lastIndexOf("\n\n```"),
    );
  }

  buildPromptContext(context: ModelSpecificContext): any {
    return {
      recentlyViewedCodeSnippets:
        context.snippetPayload.recentlyVisitedRangesSnippets.map((snip) => ({
          filepath: snip.filepath,
          content: snip.content,
        })) ?? [],
      currentFileContent: context.helper.fileContents,
      editableRegionStartLine: context.editableRegionStartLine,
      editableRegionEndLine: context.editableRegionEndLine,
      editDiffHistory: context.diffContext,
      currentFilePath: context.helper.filepath,
    };
  }

  async generatePrompts(context: ModelSpecificContext): Promise<Prompt[]> {
    const promptCtx = this.buildPromptContext(context);

    // Build the Mercury-specific prompt blocks.
    const recentlyViewedSnippets = recentlyViewedCodeSnippetsBlock(
      promptCtx.recentlyViewedCodeSnippets,
    );

    const currentFileContent = currentFileContentBlock(
      promptCtx.currentFileContent,
      promptCtx.editableRegionStartLine,
      promptCtx.editableRegionEndLine,
      context.helper.pos,
    );

    const editHistory = editHistoryBlock(promptCtx.editDiffHistory);

    // Construct the full user prompt following Mercury's template.
    // TODO: Consider borrowing the templating engine from NextEditPromptEngine.ts
    const userPromptContent = [
      `${MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN}`,
      recentlyViewedSnippets,
      `${MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE}`,
      "",
      `${MERCURY_CURRENT_FILE_CONTENT_OPEN}`,
      currentFileContent,
      `${MERCURY_CURRENT_FILE_CONTENT_CLOSE}`,
      "",
      `${MERCURY_EDIT_DIFF_HISTORY_OPEN}`,
      editHistory,
      `${MERCURY_EDIT_DIFF_HISTORY_CLOSE}`,
    ].join("\n");

    return [
      {
        role: "system",
        content: this.getSystemPrompt(),
      },
      {
        role: "user",
        content: userPromptContent,
      },
    ];
  }

  calculateEditableRegion(
    helper: HelperVars,
    usingFullFileDiff: boolean,
  ): {
    editableRegionStartLine: number;
    editableRegionEndLine: number;
  } {
    if (usingFullFileDiff) {
      return this.calculateOptimalEditableRegion(helper, 512, "tokenizer");
    } else {
      const { topMargin, bottomMargin } = this.getWindowSize();
      return {
        editableRegionStartLine: Math.max(helper.pos.line - topMargin, 0),
        editableRegionEndLine: Math.min(
          helper.pos.line + bottomMargin,
          helper.fileLines.length - 1,
        ),
      };
    }
  }
}
