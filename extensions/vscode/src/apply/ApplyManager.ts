import { ConfigHandler } from "core/config/ConfigHandler";
import { applyCodeBlock } from "core/edit/lazy/applyCodeBlock";
import { getUriPathBasename } from "core/util/uri";
import * as vscode from "vscode";

import { VerticalDiffManager } from "../diff/vertical/manager";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

export interface ApplyToFileOptions {
  streamId: string;
  filepath?: string;
  text: string;
  toolCallId?: string;
}

/**
 * Handles applying text/code to files including diff generation and streaming
 */
export class ApplyManager {
  constructor(
    private readonly ide: VsCodeIde,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly verticalDiffManagerPromise: Promise<VerticalDiffManager>,
    private readonly configHandlerPromise: Promise<ConfigHandler>,
  ) {}

  async applyToFile({
    streamId,
    filepath,
    text,
    toolCallId,
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
    const configHandler = await this.configHandlerPromise;

    const { config } = await configHandler.loadConfig();
    if (!config) {
      vscode.window.showErrorMessage("Config not loaded");
      return;
    }

    const verticalDiffManager = await this.verticalDiffManagerPromise;

    const llm =
      config.selectedModelByRole.apply ?? config.selectedModelByRole.chat;
    if (!llm) {
      vscode.window.showErrorMessage(
        `No model with roles "apply" or "chat" found in config.`,
      );
      return;
    }

    const [instant, diffLines] = await applyCodeBlock(
      editor.document.getText(),
      text,
      getUriPathBasename(editor.document.uri.toString()),
      llm,
    );

    if (instant) {
      await verticalDiffManager.streamDiffLines(
        diffLines,
        instant,
        streamId,
        toolCallId,
      );
    } else {
      await this.handleNonInstantDiff(
        editor,
        text,
        llm,
        streamId,
        verticalDiffManager,
        toolCallId,
      );
    }
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

    await verticalDiffManager.streamEdit(
      prompt,
      llm,
      streamId,
      undefined,
      undefined,
      rangeToApplyTo,
      text,
      toolCallId,
    );
  }
}
