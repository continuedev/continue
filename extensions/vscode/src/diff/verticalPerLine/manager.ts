import type { ConfigHandler } from "core/config/handler";
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

  private userChangeListener: vscode.Disposable | undefined;

  constructor(private readonly configHandler: ConfigHandler) {
    this.userChangeListener = undefined;
  }

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

  getHandlerForFile(filepath: string) {
    return this.filepathToHandler.get(filepath);
  }

  // Creates a listener for document changes by user.
  private enableDocumentChangeListener(): vscode.Disposable | undefined {
    if (this.userChangeListener) {
      //Only create one listener per file
      return;
    }

    this.userChangeListener = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        // Check if there is an active handler for the affected file
        const filepath = event.document.uri.fsPath;
        const handler = this.getHandlerForFile(filepath);
        if (handler) {
          // If there is an active diff for that file, handle the document change
          this.handleDocumentChange(event, handler);
        }
      },
    );
  }

  // Listener for user doc changes is disabled during updates to the text document by continue
  public disableDocumentChangeListener() {
    if (this.userChangeListener) {
      this.userChangeListener.dispose();
      this.userChangeListener = undefined;
    }
  }

  private handleDocumentChange(
    event: vscode.TextDocumentChangeEvent,
    handler: VerticalPerLineDiffHandler,
  ) {
    // Loop through each change in the event
    event.contentChanges.forEach((change) => {
      // Calculate the number of lines added or removed
      const linesAdded = change.text.split("\n").length - 1;
      const linesDeleted = change.range.end.line - change.range.start.line;
      const lineDelta = linesAdded - linesDeleted;

      // Update the diff handler with the new line delta
      handler.updateLineDelta(
        event.document.uri.fsPath,
        change.range.start.line,
        lineDelta,
      );
    });
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

    this.disableDocumentChangeListener();

    vscode.commands.executeCommand("setContext", "continue.diffVisible", false);
  }

  async acceptRejectVerticalDiffBlock(
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

    const blocks = this.filepathToCodeLens.get(filepath);
    const block = blocks?.[index];
    if (!blocks || !block) {
      return;
    }

    const handler = this.getHandlerForFile(filepath);
    if (!handler) {
      return;
    }

    // Disable listening to file changes while continue makes changes
    this.disableDocumentChangeListener();

    // CodeLens object removed from editorToVerticalDiffCodeLens here
    await handler.acceptRejectBlock(
      accept,
      block.start,
      block.numGreen,
      block.numRed,
    );

    if (blocks.length === 1) {
      this.clearForFilepath(filepath, true);
    } else {
      // Re-enable listener for user changes to file
      this.enableDocumentChangeListener();
    }
  }

  async streamEdit(
    input: string,
    modelTitle: string | undefined,
    onlyOneInsertion?: boolean,
    quickEdit?: string,
  ) {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);

    let editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    const filepath = editor.document.uri.fsPath;

    // Initialize start/end at editor selection
    let startLine = editor.selection.start.line;
    let endLine = editor.selection.end.line;

    // Check for existing handlers in the same file the new one will be created in
    const existingHandler = this.getHandlerForFile(filepath);

    if (existingHandler) {
      let existingStartLine = existingHandler?.range.start.line;
      if (quickEdit) {
        // Previous diff was a quickEdit
        // Check if user has highlighted a range
        let rangeBool =
          startLine != endLine ||
          editor.selection.start.character != editor.selection.end.character;

        // Check if the range is different from the previous range
        let newRangeBool =
          startLine != existingHandler.range.start.line ||
          endLine != existingHandler.range.end.line;

        if (!rangeBool || !newRangeBool) {
          // User did not highlight a new range -> use start/end from the previous quickEdit
          startLine = existingHandler.range.start.line;
          endLine = existingHandler.range.end.line;
        }
      }

      // Clear the previous handler
      let effectiveLineDelta =
        existingHandler.getLineDeltaBeforeLine(startLine);
      existingHandler.clear(false);

      startLine += effectiveLineDelta;
      endLine += effectiveLineDelta;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    // Create new handler with determined start/end
    const diffHandler = this.createVerticalPerLineDiffHandler(
      filepath,
      startLine,
      endLine,
      input,
    );

    if (!diffHandler) {
      console.warn("Issue occured while creating new vertical diff handler");
      return;
    }

    let selectedRange = diffHandler.range;

    // Only if the selection is empty, use exact prefix/suffix instead of by line
    if (selectedRange.isEmpty) {
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
          onlyOneInsertion,
        ),
      );

      // enable a listener for user edits to file while diff is open
      this.enableDocumentChangeListener();
    } catch (e) {
      this.disableDocumentChangeListener();
      vscode.window.showErrorMessage(`Error streaming diff: ${e}`);
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }
}
