import { DiffLine, ILLM, RuleWithSource } from "core";
import * as vscode from "vscode";

import { streamDiffLines } from "core/edit/streamDiffLines";
import EditDecorationManager from "../../quickEdit/EditDecorationManager";
import { handleLLMError } from "../../util/errorHandling";
import { VsCodeWebviewProtocol } from "../../webviewProtocol";

// Placeholder: Assuming generateDiffAsync is defined elsewhere and needs to be imported
// import { generateDiffAsync } from "./diffUtils"; // Or the correct path

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
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly editDecorationManager: EditDecorationManager,
  ) {
    this.userChangeListener = undefined;
  }

  createVerticalDiffHandler(
    editor: vscode.TextEditor,
    startLine: number,
    endLine: number,
    options: VerticalDiffHandlerOptions,
  ): VerticalDiffHandler | undefined {
    const fileUri = editor.document.uri.toString();

    if (this.fileUriToHandler.has(fileUri)) {
      this.fileUriToHandler.get(fileUri)?.clear(false);
      this.fileUriToHandler.delete(fileUri);
    }

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
      editor,
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
      const handled = await handleLLMError(e);
      if (!handled) {
        let message = "Error streaming edit diffs";
        if (e instanceof Error) {
          message += `: ${e.message}`;
        }
        throw new Error(message);
      }
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }

  async streamEdit({
    input,
    llm,
    streamId,
    onlyOneInsertion,
    quickEdit,
    range,
    newCode,
    toolCallId,
    rulesToInclude,
    fileUriFromQuickPick,
  }: {
    input: string;
    llm: ILLM;
    streamId?: string;
    onlyOneInsertion?: boolean;
    quickEdit?: string;
    range?: vscode.Range;
    newCode?: string;
    toolCallId?: string;
    rulesToInclude: undefined | RuleWithSource[];
    fileUriFromQuickPick?: string;
  }): Promise<string | undefined> {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);
    console.log(`
>>>>>>>>>>>>>>
[CONTINUE DEBUG VDM - streamEdit CALLED]
fileUriFromQuickPick: ${fileUriFromQuickPick}
Initially active editor: ${vscode.window.activeTextEditor?.document.uri.toString()}
>>>>>>>>>>>>>>
`);

    let tentativeEditor: vscode.TextEditor | undefined;
    let tentativeFileUri: string | undefined;

    if (fileUriFromQuickPick) {
      tentativeFileUri = fileUriFromQuickPick;
      tentativeEditor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === tentativeFileUri,
      );
      if (!tentativeEditor) {
        const document = vscode.workspace.textDocuments.find(
          (doc) => doc.uri.toString() === tentativeFileUri,
        );
        console.log(
          `[Continue DEBUG VDM] Document for ${tentativeFileUri} in textDocuments: ${document ? "FOUND" : "NOT FOUND"}`,
        );
        if (document) {
          try {
            console.log(
              `[Continue DEBUG VDM] Attempting to showTextDocument for ${tentativeFileUri}`,
            );
            tentativeEditor = await vscode.window.showTextDocument(document, {
              preserveFocus: true,
            });
            console.log(
              `[Continue DEBUG VDM] showTextDocument result for ${tentativeFileUri}: editor is ${tentativeEditor ? "DEFINED" : "UNDEFINED"}`,
            );
          } catch (e) {
            console.warn(
              `[Continue DEBUG VDM] Failed to showTextDocument for ${tentativeFileUri}:`,
              e,
            );
            tentativeEditor = undefined;
          }
        } else {
          console.log(
            `[Continue DEBUG VDM] Document ${tentativeFileUri} not found in workspace.textDocuments.`,
          );
        }
      }
    } else if (vscode.window.activeTextEditor) {
      tentativeEditor = vscode.window.activeTextEditor;
      tentativeFileUri = tentativeEditor.document.uri.toString();
    }

    if (!tentativeEditor || !tentativeFileUri) {
      console.warn(
        `[Continue DEBUG VDM] FINAL CHECK FAILED: tentativeEditor is ${tentativeEditor ? "DEFINED" : "UNDEFINED"}, tentativeFileUri is ${tentativeFileUri || "UNDEFINED"}. Cannot stream edit for URI "${fileUriFromQuickPick || "active editor (none found)"}".`,
      );
      return undefined;
    }

    const editor: vscode.TextEditor = tentativeEditor;
    const fileUri: string = tentativeFileUri;

    console.log(`
>>>>>>>>>>>>>>
[CONTINUE DEBUG VDM - streamEdit RESOLVED]
Resolved editor URI: ${editor.document.uri.toString()}
Target file URI: ${fileUri}
>>>>>>>>>>>>>>
`);

    const existingHandler = this.getHandlerForFile(fileUri);
    if (existingHandler && !quickEdit) {
      // Don't clear if it's a follow-up quickEdit
      await existingHandler.clear(false);
      // Add a small delay to ensure decorations are cleared before new ones are added
      // This was causing issues with overlapping decorations, especially if the new edit was quick
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    let startLine: number, endLine: number;
    if (range) {
      // Explicit range passed
      startLine = range.start.line;
      endLine = range.end.line;
    } else if (quickEdit && existingHandler?.range) {
      // If this is a quickEdit follow-up and a new range isn't selected by the user,
      // use the range from the existing handler.
      const currentSelectionEmptyOrUnchanged =
        editor.selection.isEmpty ||
        (editor.selection.start.line === existingHandler.range.start.line &&
          editor.selection.end.line === existingHandler.range.end.line);

      if (currentSelectionEmptyOrUnchanged) {
        startLine = existingHandler.range.start.line;
        endLine = existingHandler.range.end.line;
      } else {
        startLine = editor.selection.start.line;
        endLine = editor.selection.end.line;
      }
    } else {
      // Default to current selection
      startLine = editor.selection.start.line;
      endLine = editor.selection.end.line;
    }

    const handlerOptions: VerticalDiffHandlerOptions = {
      // input, // User's prompt for the edit - input is now a top-level param for streamDiffLines
      // llm, // llm is now a top-level param for streamDiffLines
      // streamId: streamId ?? fileUri, // streamId is not directly part of VerticalDiffHandlerOptions
      // onlyOneInsertion, // This is a parameter for streamDiffLines, not VerticalDiffHandlerOptions
      // range: new vscode.Range(startLine, 0, endLine, 0), // VerticalDiffHandler manages its own range via constructor
      onStatusUpdate: (status, numDiffs, text) => {
        this.webviewProtocol.request("updateApplyState", {
          streamId: streamId ?? fileUri, // Use streamId from outer scope or fileUri
          filepath: fileUri,
          status,
          numDiffs,
          fileContent: text,
          toolCallId,
        });
      },
      // newCode, // Used if we want to bypass LLM and directly apply a change - not part of VerticalDiffHandlerOptions
      // quickEdit, // Original prompt from a prior quick edit, if this is a follow-up - not part of VerticalDiffHandlerOptions
      // fileUri: fileUri, // Not part of VerticalDiffHandlerOptions, handler gets it from editor
      // rulesToInclude, // rulesToInclude is now a top-level param for streamDiffLines
    };

    const handler = this.createVerticalDiffHandler(
      editor,
      startLine,
      endLine,
      handlerOptions,
    );

    if (!handler) {
      console.warn(`Failed to create VerticalDiffHandler for ${fileUri}`);
      return undefined;
    }
    this.fileUriToHandler.set(fileUri, handler);
    this.enableDocumentChangeListener();

    try {
      // Determine the actual range content for the LLM context
      // This might be different from handler.range if selection was empty
      let llmContextRange = handler.range;
      if (editor.selection.isEmpty && !range) {
        // if no explicit range and selection is a cursor
        llmContextRange = new vscode.Range(
          editor.selection.start.with(undefined, 0), // current line start
          editor.selection.end.with(undefined, Number.MAX_SAFE_INTEGER), // current line end
        );
      }

      const originalContent = editor.document.getText(llmContextRange);

      // Use streamDiffLines to generate the diff
      const diffGenerator = newCode
        ? (() => {
            // Simulate DiffLine stream for direct newCode application
            // This is a simplified approach. Ideally, a proper diffing
            // function (like myers diff) would be used here too if newCode is substantial.
            // For now, assume newCode replaces the llmContextRange entirely.
            const originalLines = originalContent.split("\n");
            const newLines = newCode.split("\n");
            async function* gen(): AsyncGenerator<DiffLine> {
              for (const line of originalLines) {
                yield { type: "old", line };
              }
              for (const line of newLines) {
                yield { type: "new", line };
              }
            }
            return gen();
          })()
        : streamDiffLines({
            prefix: editor.document.getText(
              new vscode.Range(
                new vscode.Position(0, 0),
                llmContextRange.start,
              ),
            ),
            highlighted: originalContent,
            suffix: editor.document.getText(
              new vscode.Range(
                llmContextRange.end,
                new vscode.Position(editor.document.lineCount, 0),
              ),
            ),
            llm,
            input,
            language: editor.document.languageId,
            abortControllerId: streamId ?? fileUri, // Use streamId or fileUri as abort controller id
            onlyOneInsertion: !!onlyOneInsertion,
            rulesToInclude,
            overridePrompt: undefined, // Add missing overridePrompt
          });

      const diffLines = await handler.run(diffGenerator);

      if (
        diffLines &&
        diffLines.length === 0 &&
        handler.insertedInCurrentBlock === 0
      ) {
        this.clearForfileUri(fileUri, true); // Accept if no changes were made
        return editor.document.getText();
      }

      // Construct the full text if needed, or just return based on handler's results
      // The primary goal is that the diff is displayed and can be applied.
      if (diffLines && diffLines.length > 0) {
        // The handler should have applied changes or staged them for acceptance.
        // This return value is likely for other parts of the system or for testing.
        // For consistency, we can reconstruct the text from diffLines.
        return diffLines
          .filter((line) => line.type === "new" || line.type === "same")
          .map((line) => line.line)
          .join("\n");
      }

      // Fallback if diffLines is undefined or empty in an unexpected way
      console.warn(
        "[Continue DEBUG VDM] streamEdit: diffLines were undefined or handler state was unexpected. Returning current editor text.",
      );
      return editor.document.getText();
    } catch (e: any) {
      this.clearForfileUri(fileUri, false);
      // Use the error handling utility
      const handled = await handleLLMError(e); // Corrected: llm.model is not needed as per handleLLMError signature
      if (!handled) {
        vscode.window.showErrorMessage(`Error applying edit: ${e.message}`);
      }
      return undefined;
    } finally {
      // Ensure streaming diff context is reset
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }
}
