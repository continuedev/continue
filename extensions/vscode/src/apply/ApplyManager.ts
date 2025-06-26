import { ConfigHandler } from "core/config/ConfigHandler";
import { applyCodeBlock } from "core/edit/lazy/applyCodeBlock";
import { getUriPathBasename } from "core/util/uri";
import * as vscode from "vscode";

import { ApplyAbortManager } from "core/edit/applyAbortManager";
import { findSearchMatch } from "core/edit/searchAndReplace/findSearchMatch";
import { generateSearchReplaceDiffLines } from "core/edit/searchAndReplace/generateSearchReplaceDiffLines";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

export interface ApplyToFileOptions {
  streamId: string;
  filepath?: string;
  text: string;
  toolCallId?: string;
  // NEW: Search/replace specific fields
  searchContent?: string;
  isSearchReplace?: boolean;
}

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
    searchContent,
    isSearchReplace,
  }: ApplyToFileOptions) {
    await this.webviewProtocol.request("updateApplyState", {
      streamId,
      status: "streaming",
      fileContent: text,
      toolCallId,
    });

    if (filepath) {
      await this.ensureFileOpen(filepath);
    }

    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor) {
      vscode.window.showErrorMessage("No active editor to apply edits to");
      return;
    }

    // NEW: Handle search/replace mode
    if (isSearchReplace && searchContent !== undefined) {
      await this.handleSearchReplace(
        activeTextEditor,
        searchContent,
        text, // This is the replace content
        streamId,
        toolCallId,
      );
      return;
    }

    // Existing logic for regular apply
    const hasExistingDocument = !!activeTextEditor.document.getText().trim();

    if (hasExistingDocument) {
      await this.handleExistingDocument(
        activeTextEditor,
        text,
        streamId,
        toolCallId,
      );
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
      vscode.window.showErrorMessage("Config not loaded");
      return;
    }

    const llm =
      config.selectedModelByRole.apply ?? config.selectedModelByRole.chat;
    if (!llm) {
      vscode.window.showErrorMessage(
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
      );
    }
  }

  /**
   * NEW: Handle search and replace operations
   */
  private async handleSearchReplace(
    editor: vscode.TextEditor,
    searchContent: string,
    replaceContent: string,
    streamId: string,
    toolCallId?: string,
  ) {
    const fileContent = editor.document.getText();

    // Find the search content in the file
    const match = findSearchMatch(fileContent, searchContent);
    if (!match) {
      throw new Error(`Search content not found in file:\n${searchContent}`);
    }

    // Generate diff lines using our search/replace diff generator
    const diffLinesGenerator = generateSearchReplaceDiffLines(
      fileContent,
      match,
      replaceContent,
    );

    // Stream through existing VerticalDiffManager infrastructure
    await this.verticalDiffManager.streamDiffLines(
      diffLinesGenerator,
      true, // isInstantApply = true (deterministic, no LLM involved)
      streamId,
      toolCallId,
    );
  }

  /**
   * Creates a prompt for applying code edits
   */
  private getApplyPrompt(text: string): string {
    return `The following code was suggested as an edit:\n\`\`\`\n${text}\n\`\`\`\nPlease apply it to the previous code.`;
  }

  private async handleNonInstantDiff(
    editor: vscode.TextEditor,
    text: string,
    llm: any,
    streamId: string,
    verticalDiffManager: VerticalDiffManager,
    toolCallId?: string,
  ) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      vscode.window.showErrorMessage("Config not loaded");
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

    await verticalDiffManager.streamEdit({
      input: prompt,
      llm,
      streamId,
      range: rangeToApplyTo,
      newCode: text,
      toolCallId,
      rulesToInclude: undefined, // No rules for apply
    });
  }
}
