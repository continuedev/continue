import { HelperVars } from "../../autocomplete/util/HelperVars.js";
import { NEXT_EDIT_MODELS } from "../../llm/constants.js";
import {
  INSTINCT_SYSTEM_PROMPT,
  INSTINCT_USER_PROMPT_PREFIX,
} from "../constants.js";
import {
  contextSnippetsBlock,
  currentFileContentBlock,
  editHistoryBlock,
} from "../templating/instinct.js";
import { ModelSpecificContext, Prompt } from "../types.js";
import { BaseNextEditProvider } from "./BaseNextEditProvider.js";

export class InstinctProvider extends BaseNextEditProvider {
  constructor() {
    super(NEXT_EDIT_MODELS.INSTINCT);
  }

  getSystemPrompt(): string {
    return INSTINCT_SYSTEM_PROMPT;
  }

  getWindowSize() {
    return { topMargin: 1, bottomMargin: 5 };
  }

  shouldInjectUniqueToken(): boolean {
    return false; // Instinct doesn't use unique tokens.
  }

  extractCompletion(message: string): string {
    return message; // Instinct returns the completion directly.
  }

  buildPromptContext(context: ModelSpecificContext): any {
    // Calculate the window around the cursor position (25 lines above and below).
    const windowStart = Math.max(0, context.helper.pos.line - 25);
    const windowEnd = Math.min(
      context.helper.fileLines.length - 1,
      context.helper.pos.line + 25,
    );

    // Ensure editable region boundaries are within the window.
    const adjustedEditableStart = Math.max(
      windowStart,
      context.editableRegionStartLine,
    );
    const adjustedEditableEnd = Math.min(
      windowEnd,
      context.editableRegionEndLine,
    );

    return {
      contextSnippets: context.autocompleteContext,
      currentFileContent: context.helper.fileContents,
      windowStart,
      windowEnd,
      editableRegionStartLine: adjustedEditableStart,
      editableRegionEndLine: adjustedEditableEnd,
      editDiffHistory: context.diffContext,
      currentFilePath: context.helper.filepath,
      languageShorthand: context.helper.lang.name,
    };
  }

  async generatePrompts(context: ModelSpecificContext): Promise<Prompt[]> {
    const promptCtx = this.buildPromptContext(context);

    // Process context snippets with Instinct-specific formatting.
    const formattedContextSnippets = contextSnippetsBlock(
      promptCtx.contextSnippets,
    );

    // Format the current file content with editable region markers.
    const formattedCurrentFileContent = currentFileContentBlock(
      promptCtx.currentFileContent,
      promptCtx.windowStart,
      promptCtx.windowEnd,
      promptCtx.editableRegionStartLine,
      promptCtx.editableRegionEndLine,
      context.helper.pos,
    );

    // Format edit history.
    const formattedEditHistory = editHistoryBlock(promptCtx.editDiffHistory);

    // Build the user prompt following Instinct's specific template.
    const userPromptContent = [
      INSTINCT_USER_PROMPT_PREFIX,
      "",
      "### Context:",
      formattedContextSnippets,
      "",
      "### User Edits:",
      "",
      formattedEditHistory,
      "",
      "### User Excerpt:",
      promptCtx.currentFilePath,
      "",
      formattedCurrentFileContent,
      "```",
      "### Response:",
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
