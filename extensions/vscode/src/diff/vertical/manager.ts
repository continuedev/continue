import { ChatMessage, DiffLine, ILLM } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { streamDiffLines } from "core/edit/streamDiffLines";
import { pruneLinesFromBottom, pruneLinesFromTop } from "core/llm/countTokens";
import { getMarkdownLanguageTagForFile } from "core/util";
import * as URI from "uri-js";
import * as vscode from "vscode";

import { isFastApplyModel } from "../../apply/utils";
import EditDecorationManager from "../../quickEdit/EditDecorationManager";
import { handleLLMError } from "../../util/errorHandling";
import { VsCodeWebviewProtocol } from "../../webviewProtocol";

import { VerticalDiffHandler, VerticalDiffHandlerOptions } from "./handler";

export interface VerticalDiffCodeLens {
  start: number;
  numRed: number;
  numGreen: number;
}

export class VerticalDiffManager {
  public refreshCodeLens: () => void = () => {};

  private fileUriToHandler: Map<string, VerticalDiffHandler> = new Map();

  fileUriToCodeLens: Map<string, VerticalDiffCodeLens[]> = new Map();

  private userChangeListener: vscode.Disposable | undefined;

  logDiffs: DiffLine[] | undefined;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly editDecorationManager: EditDecorationManager,
  ) {
    this.userChangeListener = undefined;
  }

  createVerticalDiffHandler(
    fileUri: string,
    startLine: number,
    endLine: number,
    options: VerticalDiffHandlerOptions,
  ) {
    if (this.fileUriToHandler.has(fileUri)) {
      this.fileUriToHandler.get(fileUri)?.clear(false);
      this.fileUriToHandler.delete(fileUri);
    }
    const editor = vscode.window.activeTextEditor; // TODO
    if (editor && URI.equal(editor.document.uri.toString(), fileUri)) {
      const handler = new VerticalDiffHandler(
        startLine,
        endLine,
        editor,
        this.fileUriToCodeLens,
        this.clearForfileUri.bind(this),
        this.refreshCodeLens,
        options,
      );
      this.fileUriToHandler.set(fileUri, handler);
      return handler;
    } else {
      return undefined;
    }
  }

  getHandlerForFile(fileUri: string) {
    return this.fileUriToHandler.get(fileUri);
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
        const fileUri = event.document.uri.toString();
        const handler = this.getHandlerForFile(fileUri);
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
    handler: VerticalDiffHandler,
  ) {
    // Loop through each change in the event
    event.contentChanges.forEach((change) => {
      // Calculate the number of lines added or removed
      const linesAdded = change.text.split("\n").length - 1;
      const linesDeleted = change.range.end.line - change.range.start.line;
      const lineDelta = linesAdded - linesDeleted;

      // Update the diff handler with the new line delta
      handler.updateLineDelta(
        event.document.uri.toString(),
        change.range.start.line,
        lineDelta,
      );
    });
  }

  clearForfileUri(fileUri: string | undefined, accept: boolean) {
    if (!fileUri) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      fileUri = activeEditor.document.uri.toString();
    }

    const handler = this.fileUriToHandler.get(fileUri);
    if (handler) {
      handler.clear(accept);
      this.fileUriToHandler.delete(fileUri);
    }

    this.disableDocumentChangeListener();

    vscode.commands.executeCommand("setContext", "continue.diffVisible", false);
  }

  async acceptRejectVerticalDiffBlock(
    accept: boolean,
    fileUri?: string,
    index?: number,
  ) {
    if (!fileUri) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      fileUri = activeEditor.document.uri.toString();
    }

    if (typeof index === "undefined") {
      index = 0;
    }

    const blocks = this.fileUriToCodeLens.get(fileUri);
    const block = blocks?.[index];
    if (!blocks || !block) {
      return;
    }

    const handler = this.getHandlerForFile(fileUri);
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
      this.clearForfileUri(fileUri, true);
    } else {
      // Re-enable listener for user changes to file
      this.enableDocumentChangeListener();
    }

    this.refreshCodeLens();
  }

  async streamDiffLines(
    diffStream: AsyncGenerator<DiffLine>,
    instant: boolean,
    streamId: string,
    toolCallId?: string,
  ) {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);

    // Get the current editor fileUri/range
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const fileUri = editor.document.uri.toString();
    const startLine = 0;
    const endLine = editor.document.lineCount - 1;

    // Check for existing handlers in the same file the new one will be created in
    const existingHandler = this.getHandlerForFile(fileUri);
    if (existingHandler) {
      existingHandler.clear(false);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    // Create new handler with determined start/end
    const diffHandler = this.createVerticalDiffHandler(
      fileUri,
      startLine,
      endLine,
      {
        instant,
        onStatusUpdate: (status, numDiffs, fileContent) =>
          void this.webviewProtocol.request("updateApplyState", {
            streamId,
            status,
            numDiffs,
            fileContent,
            filepath: fileUri,
            toolCallId,
          }),
      },
    );

    if (!diffHandler) {
      console.warn("Issue occurred while creating new vertical diff handler");
      return;
    }

    if (editor.selection) {
      // Unselect the range
      editor.selection = new vscode.Selection(
        editor.selection.active,
        editor.selection.active,
      );
    }

    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      true,
    );

    try {
      this.logDiffs = await diffHandler.run(diffStream);

      // enable a listener for user edits to file while diff is open
      this.enableDocumentChangeListener();
    } catch (e) {
      this.disableDocumentChangeListener();
      if (!handleLLMError(e)) {
        vscode.window.showErrorMessage(`Error streaming diff: ${e}`);
      }
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }

  async streamEdit(
    input: string,
    llm: ILLM,
    streamId?: string,
    onlyOneInsertion?: boolean,
    quickEdit?: string,
    range?: vscode.Range,
    newCode?: string,
    toolCallId?: string,
  ): Promise<string | undefined> {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);

    let editor = vscode.window.activeTextEditor;

    if (!editor) {
      return undefined;
    }

    const fileUri = editor.document.uri.toString();

    let startLine, endLine: number;

    if (range) {
      startLine = range.start.line;
      endLine = range.end.line;
    } else {
      startLine = editor.selection.start.line;
      endLine = editor.selection.end.line;
    }

    // Check for existing handlers in the same file the new one will be created in
    const existingHandler = this.getHandlerForFile(fileUri);

    if (existingHandler) {
      if (quickEdit) {
        // Previous diff was a quickEdit
        // Check if user has highlighted a range
        let rangeBool =
          startLine !== endLine ||
          editor.selection.start.character !== editor.selection.end.character;

        // Check if the range is different from the previous range
        let newRangeBool =
          startLine !== existingHandler.range.start.line ||
          endLine !== existingHandler.range.end.line;

        if (!rangeBool || !newRangeBool) {
          // User did not highlight a new range -> use start/end from the previous quickEdit
          startLine = existingHandler.range.start.line;
          endLine = existingHandler.range.end.line;
        }
      }

      // Clear the previous handler
      // This allows the user to edit above the changed area,
      // but extra delta was added for each line generated by Continue
      // Before adding this back, we need to distinguish between human and Continue
      // let effectiveLineDelta =
      //   existingHandler.getLineDeltaBeforeLine(startLine);
      // startLine += effectiveLineDelta;
      // endLine += effectiveLineDelta;

      existingHandler.clear(false);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    // Create new handler with determined start/end
    const diffHandler = this.createVerticalDiffHandler(
      fileUri,
      startLine,
      endLine,
      {
        instant: isFastApplyModel(llm),
        input,
        onStatusUpdate: (status, numDiffs, fileContent) =>
          streamId &&
          void this.webviewProtocol.request("updateApplyState", {
            streamId,
            status,
            numDiffs,
            fileContent,
            filepath: fileUri,
            toolCallId,
          }),
      },
    );

    if (!diffHandler) {
      console.warn("Issue occurred while creating new vertical diff handler");
      return undefined;
    }

    let selectedRange = diffHandler.range;

    // Only if the selection is empty, use exact prefix/suffix instead of by line
    if (selectedRange.isEmpty) {
      selectedRange = new vscode.Range(
        editor.selection.start.with(undefined, 0),
        editor.selection.end.with(undefined, Number.MAX_SAFE_INTEGER),
      );
    }

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

    let overridePrompt: ChatMessage[] | undefined;
    if (llm.promptTemplates?.apply) {
      const rendered = llm.renderPromptTemplate(llm.promptTemplates.apply, [], {
        original_code: rangeContent,
        new_code: newCode ?? "",
      });
      overridePrompt =
        typeof rendered === "string"
          ? [{ role: "user", content: rendered }]
          : rendered;
    }

    if (editor.selection) {
      // Unselect the range
      editor.selection = new vscode.Selection(
        editor.selection.active,
        editor.selection.active,
      );
    }

    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      true,
    );

    this.editDecorationManager.clear();

    try {
      const streamedLines: string[] = [];

      async function* recordedStream() {
        const stream = streamDiffLines(
          prefix,
          rangeContent,
          suffix,
          llm,
          input,
          getMarkdownLanguageTagForFile(fileUri),
          !!onlyOneInsertion,
          overridePrompt,
        );

        for await (const line of stream) {
          if (line.type === "new" || line.type === "same") {
            streamedLines.push(line.line);
          }
          yield line;
        }
      }

      this.logDiffs = await diffHandler.run(recordedStream());

      // enable a listener for user edits to file while diff is open
      this.enableDocumentChangeListener();

      return `${prefix}${streamedLines.join("\n")}${suffix}`;
    } catch (e) {
      this.disableDocumentChangeListener();
      if (!handleLLMError(e)) {
        vscode.window.showErrorMessage(`Error streaming diff: ${e}`);
      }
      return undefined;
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }
}
