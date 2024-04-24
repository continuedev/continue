import { ConfigHandler } from "core/config/handler";
import { pruneLinesFromBottom, pruneLinesFromTop } from "core/llm/countTokens";
import { getMarkdownLanguageTagForFile } from "core/util";
import { streamDiffLines } from "core/util/verticalEdit";
import * as vscode from "vscode";
import { VerticalPerLineDiffHandler } from "./handler";
import { start } from "repl";

export interface VerticalDiffCodeLens {
  start: number;
  numRed: number;
  numGreen: number;
}

export class VerticalPerLineDiffManager {
  public refreshCodeLens: () => void = () => { };

  private filepathToHandler: Map<string, VerticalPerLineDiffHandler> =
    new Map();

  filepathToCodeLens: Map<string, VerticalDiffCodeLens[]> = new Map();

  constructor(private readonly configHandler: ConfigHandler) {
    this.setupDocumentChangeListener();
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

  //Creates a listener for document changes (called by constructor)
  private setupDocumentChangeListener() {
    vscode.workspace.onDidChangeTextDocument((event) => {
      // Check if there is an active handler for the affected file
      const filepath = event.document.uri.fsPath;
      const handler = this.getHandlerForFile(filepath);
      if (handler) {
        // If there is an active diff for that file, handle the document change
        this.handleDocumentChange(event, handler);
      }
    });
  }

  private handleDocumentChange(
    event: vscode.TextDocumentChangeEvent,
    handler: VerticalPerLineDiffHandler
  ) {
    // Loop through each change in the event
    event.contentChanges.forEach((change) => {
      // Calculate the number of lines added or removed
      const linesAdded = change.text.split('\n').length - 1;
      const linesDeleted = change.range.end.line - change.range.start.line;
      const lineDelta = linesAdded - linesDeleted;

      // Update the diff handler with the new line delta
      handler.updateLineDelta(event.document.uri.fsPath, change.range.start.line, lineDelta);
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

    vscode.commands.executeCommand("setContext", "continue.diffVisible", false);
  }

  acceptRejectVerticalDiffBlock(
    accept: boolean,
    filepath?: string,
    index?: number,
    all?:boolean
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

    const handler = this.getHandlerForFile(filepath);
    if (!handler) {
      return;
    }

    let blocks = this.filepathToCodeLens.get(filepath);
    if (!blocks) {
      return;
    }

    //if 'all' is false, only handle the block at the specified index
    let toHandle = []
    if (!all && blocks.length > 1) {
      if (!blocks || blocks.length <= index) {
        return;
      }
      toHandle.push(blocks[index])
    } else {
      toHandle = blocks.slice()
    }

    for (const block of toHandle) {
      // CodeLens object removed from editorToVerticalDiffCodeLens here
      handler.acceptRejectBlock(
        accept,
        block.start,
        block.numGreen,
        block.numRed,
      );
    }

    if (blocks.length === 1 || all) {
      this.clearForFilepath(filepath, true);
    }
  }

  async streamEdit(input: string, modelTitle: string | undefined, quickEdit?: string) {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);

    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    const filepath = editor.document.uri.fsPath;

    //Check for existing diffs in the same file the new one will be created in
    const existingHandler = this.getHandlerForFile(filepath);

    //initialize start/end line to existing handler if it exists and should reuse previousInput,
    // otherwise, use the editor selection
    const startLine = (quickEdit && existingHandler) ? existingHandler.range.start.line : editor.selection.start.line
    const endLine = (quickEdit && existingHandler) ? existingHandler.range.end.line : editor.selection.end.line

    if (existingHandler && !quickEdit) { //If there is an existing handler and should not reuse block
      //reject the existing diff
      console.log("New diff being created - rejecting previous diff in: ", filepath)
      this.acceptRejectVerticalDiffBlock(false, filepath)
    } 

    existingHandler?.clear(false);

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });


    //Create new handler
    const diffHandler = this.createVerticalPerLineDiffHandler(
      filepath,
      startLine,
      endLine,
      input,
    );
    if (!diffHandler) {
      return;
    }

    let selectedRange = editor.selection;

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
