import { ConfigHandler } from "core/config/handler";
import { pruneLinesFromBottom, pruneLinesFromTop } from "core/llm/countTokens";
import { getMarkdownLanguageTagForFile } from "core/util";
import { streamDiffLines } from "core/util/verticalEdit";
import * as vscode from "vscode";
import { VerticalPerLineDiffHandler } from "./handler";

export interface VerticalDiffCodeLens {
  start: number;
  numRed: number;
  numGreen: number;
}

export class VerticalPerLineDiffManager {
  public refreshCodeLens: () => void = () => {};

  private filepathToHandler: Map<string, VerticalPerLineDiffHandler> =
    new Map();

  filepathToCodeLens: Map<string, VerticalDiffCodeLens[]> = new Map();

  constructor(private readonly configHandler: ConfigHandler) {}

  createVerticalPerLineDiffHandler(
    filepath: string,
    startLine: number,
    endLine: number,
    input: string,
  ) {
    if (this.filepathToHandler.has(filepath)) {
      this.filepathToHandler.get(filepath)?.clear(false);
      this.filepathToHandler.delete(filepath);
    }
    const editor = vscode.window.activeTextEditor; // TODO
    if (editor && editor.document.uri.fsPath === filepath) {
      const handler = new VerticalPerLineDiffHandler(
        startLine,
        endLine,
        editor,
        this.filepathToCodeLens,
        this.clearForFilepath.bind(this),
        this.refreshCodeLens,
        input,
      );
      this.filepathToHandler.set(filepath, handler);
      return handler;
    } else {
      return undefined;
    }
  }

  getOrCreateVerticalPerLineDiffHandler(
    filepath: string,
    startLine: number,
    endLine: number,
  ) {
    if (this.filepathToHandler.has(filepath)) {
      return this.filepathToHandler.get(filepath)!;
    } else {
      const editor = vscode.window.activeTextEditor; // TODO
      if (editor && editor.document.uri.fsPath === filepath) {
        const handler = new VerticalPerLineDiffHandler(
          startLine,
          endLine,
          editor,
          this.filepathToCodeLens,
          this.clearForFilepath.bind(this),
          this.refreshCodeLens,
        );
        this.filepathToHandler.set(filepath, handler);
        return handler;
      } else {
        return undefined;
      }
    }
  }

  getHandlerForFile(filepath: string) {
    return this.filepathToHandler.get(filepath);
  }

  clearForFilepath(filepath: string | undefined, accept: boolean) {
    if (!filepath) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      filepath = activeEditor.document.uri.fsPath;
    }

    const handler = this.filepathToHandler.get(filepath);
    if (handler) {
      handler.clear(accept);
      this.filepathToHandler.delete(filepath);
    }

    vscode.commands.executeCommand("setContext", "continue.diffVisible", false);
  }

  acceptRejectVerticalDiffBlock(
    accept: boolean,
    filepath?: string,
    index?: number,
  ) {
    if (!filepath) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      filepath = activeEditor.document.uri.fsPath;
    }

    if (typeof index === "undefined") {
      index = 0;
    }

    let blocks = this.filepathToCodeLens.get(filepath);
    const block = blocks?.[index];
    if (!blocks || !block) {
      return;
    }

    const handler = this.getHandlerForFile(filepath);
    if (!handler) {
      return;
    }

    // CodeLens object removed from editorToVerticalDiffCodeLens here
    handler.acceptRejectBlock(
      accept,
      block.start,
      block.numGreen,
      block.numRed,
    );

    if (blocks.length === 1) {
      this.clearForFilepath(filepath, true);
    }
  }

  async streamEdit(input: string, modelTitle: string | undefined) {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const filepath = editor.document.uri.fsPath;
    const startLine = editor.selection.start.line;
    const endLine = editor.selection.end.line;

    const existingHandler = this.getHandlerForFile(filepath);
    existingHandler?.clear(false);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    const diffHandler = this.createVerticalPerLineDiffHandler(
      filepath,
      existingHandler?.range.start.line ?? startLine,
      existingHandler?.range.end.line ?? endLine,
      input,
    );
    if (!diffHandler) {
      return;
    }

    let selectedRange = existingHandler?.range ?? editor.selection;

    // Only if the selection is empty, use exact prefix/suffix instead of by line
    if (!selectedRange.isEmpty) {
      selectedRange = new vscode.Range(
        editor.selection.start.with(undefined, 0),
        editor.selection.end.with(undefined, Number.MAX_SAFE_INTEGER),
      );
    }

    const llm = await this.configHandler.llmFromTitle(modelTitle);
    const rangeContent = editor.document.getText(selectedRange);
    const prefix = pruneLinesFromTop(
      editor.document.getText(
        new vscode.Range(new vscode.Position(0, 0), selectedRange.start),
      ),
      llm.contextLength / 4,
      llm.model,
    );
    const suffix = pruneLinesFromBottom(
      editor.document.getText(
        new vscode.Range(
          selectedRange.end,
          new vscode.Position(editor.document.lineCount, 0),
        ),
      ),
      llm.contextLength / 4,
      llm.model,
    );

    // Unselect the range
    editor.selection = new vscode.Selection(
      editor.selection.active,
      editor.selection.active,
    );

    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      true,
    );

    try {
      await diffHandler.run(
        streamDiffLines(
          prefix,
          rangeContent,
          suffix,
          llm,
          input,
          getMarkdownLanguageTagForFile(filepath),
        ),
      );
    } catch (e) {
      console.error("Error streaming diff:", e);
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }
}
