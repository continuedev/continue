import { HelperVars } from "../../autocomplete/util/HelperVars.js";
import { NEXT_EDIT_MODELS } from "../../llm/constants.js";
import { INSTINCT_SYSTEM_PROMPT } from "../constants.js";
import {
  contextSnippetsBlock,
  currentFileContentBlock,
  editHistoryBlock,
} from "../templating/instinct.js";
import {
  NEXT_EDIT_MODEL_TEMPLATES,
  PromptTemplateRenderer,
} from "../templating/NextEditPromptEngine.js";
import { ModelSpecificContext, Prompt, PromptMetadata } from "../types.js";
import { BaseNextEditModelProvider } from "./BaseNextEditProvider.js";

export class InstinctProvider extends BaseNextEditModelProvider {
  private templateRenderer: PromptTemplateRenderer;

  constructor() {
    super(NEXT_EDIT_MODELS.INSTINCT);

    const template = NEXT_EDIT_MODEL_TEMPLATES[NEXT_EDIT_MODELS.INSTINCT];
    this.templateRenderer = new PromptTemplateRenderer(template.template);
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

    const templateVars = {
      contextSnippets: contextSnippetsBlock(promptCtx.contextSnippets),
      currentFileContent: currentFileContentBlock(
        promptCtx.currentFileContent,
        promptCtx.windowStart,
        promptCtx.windowEnd,
        promptCtx.editableRegionStartLine,
        promptCtx.editableRegionEndLine,
        context.helper.pos,
      ),
      editDiffHistory: editHistoryBlock(promptCtx.editDiffHistory),
      currentFilePath: promptCtx.currentFilePath,
      languageShorthand: promptCtx.languageShorthand,
    };

    const userPromptContent = this.templateRenderer.render(templateVars);

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

  buildPromptMetadata(context: ModelSpecificContext): PromptMetadata {
    const promptCtx = this.buildPromptContext(context);

    const templateVars = {
      contextSnippets: contextSnippetsBlock(promptCtx.contextSnippets),
      currentFileContent: currentFileContentBlock(
        promptCtx.currentFileContent,
        promptCtx.windowStart,
        promptCtx.windowEnd,
        promptCtx.editableRegionStartLine,
        promptCtx.editableRegionEndLine,
        context.helper.pos,
      ),
      editDiffHistory: editHistoryBlock(promptCtx.editDiffHistory),
      currentFilePath: promptCtx.currentFilePath,
      languageShorthand: promptCtx.languageShorthand,
    };

    const userPromptContent = this.templateRenderer.render(templateVars);

    return {
      prompt: {
        role: "user",
        content: userPromptContent,
      },
      userEdits: promptCtx.editDiffHistory.join("\n"),
      userExcerpts: templateVars.currentFileContent,
    };
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
