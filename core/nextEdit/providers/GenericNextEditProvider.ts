import { HelperVars } from "../../autocomplete/util/HelperVars.js";
import { ModelSpecificContext, Prompt, PromptMetadata } from "../types.js";
import { BaseNextEditModelProvider } from "./BaseNextEditProvider.js";

const SYSTEM_PROMPT = `You predict the developer's next code edit. Return only the complete revised contents of the marked editable region. Do not return Markdown fences, explanations, line numbers, or text outside that region. Preserve the developer's style and do not change code outside the editable region.`;

export class GenericNextEditProvider extends BaseNextEditModelProvider {
  constructor(modelName: string) {
    super(modelName);
  }

  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  getWindowSize() {
    return { topMargin: 1, bottomMargin: 5 };
  }

  extractCompletion(message: string): string {
    const fenced = message.match(/```(?:[\w+-]+)?\s*\n?([\s\S]*?)\n?```/);
    return fenced?.[1] ?? message;
  }

  buildPromptContext(context: ModelSpecificContext) {
    const { helper, editableRegionStartLine, editableRegionEndLine } = context;
    const editableRegion = helper.fileLines
      .slice(editableRegionStartLine, editableRegionEndLine + 1)
      .join("\n");

    return {
      currentFilePath: helper.filepath,
      editableRegion,
      editDiffHistory: context.diffContext,
    };
  }

  async generatePrompts(context: ModelSpecificContext): Promise<Prompt[]> {
    const prompt = this.buildPromptMetadata(context).prompt;
    return [{ role: "system", content: this.getSystemPrompt() }, prompt];
  }

  buildPromptMetadata(context: ModelSpecificContext): PromptMetadata {
    const promptCtx = this.buildPromptContext(context);
    const editHistory = promptCtx.editDiffHistory.join("\n");

    return {
      prompt: {
        role: "user",
        content: `File: ${promptCtx.currentFilePath}\n\nRecent edits:\n${editHistory || "(none)"}\n\nEditable region:\n${promptCtx.editableRegion}`,
      },
      userEdits: editHistory,
      userExcerpts: promptCtx.editableRegion,
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
    }

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
