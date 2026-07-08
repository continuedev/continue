import { ConfigHandler } from "core/config/ConfigHandler";
import { applyCodeBlock } from "core/edit/lazy/applyCodeBlock";
import { getUriPathBasename } from "core/util/uri";
import * as vscode from "vscode";

import { ApplyToFilePayload } from "core";
import { myersDiff } from "core/diff/myers";
import { generateLines } from "core/diff/util";
import { ApplyAbortManager } from "core/edit/applyAbortManager";
import { streamDiffLines } from "core/edit/streamDiffLines";
import { pruneLinesFromBottom, pruneLinesFromTop } from "core/llm/countTokens";
import { getMarkdownLanguageTagForFile } from "core/util";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

/**
 * Handles applying text/code to files including diff generation and streaming
 */
export class ApplyManager {
  constructor(
    private readonly ide: VsCodeIde,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly verticalDiffManager: VerticalDiffManager,
    private readonly configHandler: ConfigHandler,
  ) {}

  async applyToFile({
    streamId,
    filepath,
    text,
    toolCallId,
    isSearchAndReplace,
  }: ApplyToFilePayload) {
    if (filepath) {
      await this.ensureFileOpen(filepath);
    }

    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor) {
      void vscode.window.showErrorMessage("No active editor to apply edits to");
      return;
    }

    // Capture the original file content before applying changes
    const originalFileContent = activeTextEditor.document.getText();

    await this.webviewProtocol.request("updateApplyState", {
      streamId,
      status: "streaming",
      fileContent: text,
      originalFileContent,
      toolCallId,
    });

    const hasExistingDocument = !!activeTextEditor.document.getText().trim();
    if (hasExistingDocument) {
      // Currently `isSearchAndReplace` will always provide a full file rewrite
      // as the contents of `text`, so we can just instantly apply
      if (isSearchAndReplace) {
        await this.verticalDiffManager.instantApplyDiff(
          originalFileContent,
          text,
          streamId,
          toolCallId,
        );
      } else {
        await this.handleExistingDocument(
          activeTextEditor,
          text,
          streamId,
          toolCallId,
        );
      }
    } else {
      await this.handleEmptyDocument(
        activeTextEditor,
        text,
        streamId,
        toolCallId,
      );
    }
  }

  private async ensureFileOpen(filepath: string): Promise<void> {
    const fileExists = await this.ide.fileExists(filepath);
    if (!fileExists) {
      await this.ide.writeFile(filepath, "");
      await this.ide.openFile(filepath);
    }
    await this.ide.openFile(filepath);
  }

  private modelIsTooFastForStreaming(model: string): boolean {
    return [/mercury/].some((r) => r.test(model));
  }

  private async handleEmptyDocument(
    editor: vscode.TextEditor,
    text: string,
    streamId: string,
    toolCallId?: string,
  ) {
    await editor.edit((builder) =>
      builder.insert(new vscode.Position(0, 0), text),
    );

    await this.webviewProtocol.request("updateApplyState", {
      streamId,
      status: "closed",
      numDiffs: 0,
      fileContent: text,
      toolCallId,
    });
  }

  private async handleExistingDocument(
    editor: vscode.TextEditor,
    text: string,
    streamId: string,
    toolCallId?: string,
  ) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      void vscode.window.showErrorMessage("Config not loaded");
      return;
    }

    const llm =
      config.selectedModelByRole.apply ?? config.selectedModelByRole.chat;
    if (!llm) {
      void vscode.window.showErrorMessage(
        `No model with roles "apply" or "chat" found in config.`,
      );
      return;
    }

    const fileUri = editor.document.uri.toString();
    const abortManager = ApplyAbortManager.getInstance();
    const abortController = abortManager.get(fileUri);

    const { isInstantApply, diffLinesGenerator } = await applyCodeBlock(
      editor.document.getText(),
      text,
      getUriPathBasename(fileUri),
      llm,
      abortController,
    );

    if (isInstantApply) {
      await this.verticalDiffManager.streamDiffLines(
        diffLinesGenerator,
        isInstantApply,
        streamId,
        toolCallId,
      );
    } else {
      await this.handleNonInstantDiff(
        editor,
        text,
        llm,
        streamId,
        this.verticalDiffManager,
        toolCallId,
        !this.modelIsTooFastForStreaming(llm.model),
      );
    }
  }

  /**
   * Creates a prompt for applying code edits
   */
  private getApplyPrompt(text: string): string {
    return `The following code was suggested as an edit:\n\`\`\`\n${text}\n\`\`\`\nPlease apply it to the previous code. Leave existing comments in place unless changes require modifying them.`;
  }

  /**
   * Calculates prefix and suffix for a given range, shared between streaming and non-streaming modes
   */
  private calculatePrefixSuffix(
    editor: vscode.TextEditor,
    range: vscode.Range,
    llm: any,
  ): { prefix: string; suffix: string; rangeContent: string } {
    const rangeContent = editor.document.getText(range);

    const prefix = pruneLinesFromTop(
      editor.document.getText(
        new vscode.Range(new vscode.Position(0, 0), range.start),
      ),
      llm.contextLength / 4,
      llm.model,
    );
    const suffix = pruneLinesFromBottom(
      editor.document.getText(
        new vscode.Range(
          range.end,
          new vscode.Position(editor.document.lineCount, 0),
        ),
      ),
      llm.contextLength / 4,
      llm.model,
    );

    return { prefix, suffix, rangeContent };
  }

  private async handleNonInstantDiff(
    editor: vscode.TextEditor,
    text: string,
    llm: any,
    streamId: string,
    verticalDiffManager: VerticalDiffManager,
    toolCallId?: string,
    streaming: boolean = true,
  ) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      void vscode.window.showErrorMessage("Config not loaded");
      return;
    }

    const prompt = this.getApplyPrompt(text);
    const fullEditorRange = new vscode.Range(
      0,
      0,
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length,
    );
    const rangeToApplyTo = editor.selection.isEmpty
      ? fullEditorRange
      : editor.selection;

    if (streaming) {
      await verticalDiffManager.streamEdit({
        input: prompt,
        llm,
        streamId,
        range: rangeToApplyTo,
        newCode: text,
        toolCallId,
        rulesToInclude: undefined, // No rules for apply
        isApply: true,
      });
    } else {
      // Non-streaming: accumulate LLM output, then apply via Myers diff
      const finalContent = await this.generateAppliedContent(
        editor,
        prompt,
        llm,
        rangeToApplyTo,
        text,
      );

      if (finalContent) {
        const diffLinesGenerator = generateLines(
          myersDiff(editor.document.getText(), finalContent),
        );

        await verticalDiffManager.streamDiffLines(
          diffLinesGenerator,
          true, // Apply instantly since we accumulated all content
          streamId,
          toolCallId,
        );
      }
    }
  }

  /**
   * Generates the final applied content by accumulating all LLM output
   * Similar to streamEdit but collects all output before applying
   */
  private async generateAppliedContent(
    editor: vscode.TextEditor,
    prompt: string,
    llm: any,
    range: vscode.Range,
    newCode: string,
  ): Promise<string | undefined> {
    const fileUri = editor.document.uri.toString();
    const { prefix, suffix, rangeContent } = this.calculatePrefixSuffix(
      editor,
      range,
      llm,
    );

    const abortManager = ApplyAbortManager.getInstance();
    const abortController = abortManager.get(fileUri);

    try {
      const streamedLines: string[] = [];

      // Use streamDiffLines to get the LLM output
      const stream = streamDiffLines(
        {
          highlighted: rangeContent,
          prefix,
          suffix,
          input: prompt,
          language: getMarkdownLanguageTagForFile(fileUri),
          type: "apply",
          newCode,
          includeRulesInSystemMessage: false,
          modelTitle: llm.title ?? llm.model,
        },
        llm,
        abortController,
        undefined,
        undefined,
      );

      // Accumulate all the streamed content
      for await (const line of stream) {
        if (abortController.signal.aborted) {
          return undefined;
        }
        if (line.type === "new" || line.type === "same") {
          streamedLines.push(line.line);
        }
      }

      // Return the complete file content
      return `${prefix}${streamedLines.join("\n")}${suffix}`;
    } catch (error) {
      console.error("Error generating applied content:", error);
      return undefined;
    }
  }
}
