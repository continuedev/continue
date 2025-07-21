import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { NextEditOutcome } from "core/nextEdit/types";
import * as vscode from "vscode";

export interface CompletionDataForAfterJump {
  completionId: string;
  outcome: NextEditOutcome;
  currentPosition: vscode.Position;
}

export class JumpManager {
  private static _instance: JumpManager | undefined;

  // Decoration state.
  private _jumpDecoration: vscode.TextEditorDecorationType | undefined;
  private _jumpDecorationVisible = false;
  private _disposables: vscode.Disposable[] = [];

  private _jumpInProgress: boolean = false;
  private _completionAfterJump: CompletionDataForAfterJump | null = null;
  private _oldCursorPosition: vscode.Position | undefined;

  private constructor() {}

  initialize() {}

  public static getInstance(): JumpManager {
    if (!JumpManager._instance) {
      JumpManager._instance = new JumpManager();
    }
    return JumpManager._instance;
  }

  public static clearInstance() {
    if (JumpManager._instance) {
      JumpManager._instance.dispose();
      JumpManager._instance = undefined;
    }
  }

  public dispose() {
    // Dispose current decoration.
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }

  public async suggestJump(
    currentPosition: vscode.Position,
    nextJumpLocation: vscode.Position,
    completionContent?: string,
  ) {
    // Deduplication logic.
    // If the content at the next jump location is
    // identical to the completion content,
    // then we don't have to jump.
    if (completionContent !== undefined) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        try {
          const completionLines = completionContent.split("\n");

          // Get document content at jump location spanning multiple lines.
          const document = editor.document;
          const startLine = nextJumpLocation.line;
          const endLine = Math.min(
            startLine + completionLines.length - 1,
            document.lineCount - 1,
          );

          // Check if we have enough lines in the document to compare.
          if (endLine - startLine + 1 < completionLines.length) {
            // Not enough lines in document, so content can't be identical.
            // Proceed to jump!
          } else {
            // Check the first line first for early exit.
            const firstLineText = document.lineAt(startLine).text;
            const firstLineSubstring = firstLineText.substring(
              nextJumpLocation.character,
            );
            const firstCompletionLine = completionLines[0];

            if (!firstLineSubstring.startsWith(firstCompletionLine)) {
              // First line doesn't match, so proceed to jump.
            } else {
              // Check remaining lines if there are any.
              if (completionLines.length > 1) {
                let fullMatch = true;

                // Process remaining lines.
                for (let i = 1; i < completionLines.length; i++) {
                  const documentLine = startLine + i;
                  if (documentLine <= endLine) {
                    const lineText = document.lineAt(documentLine).text;
                    if (lineText !== completionLines[i]) {
                      fullMatch = false;
                      break;
                    }
                  }
                }

                if (fullMatch) {
                  console.log(
                    "Skipping jump as content is identical at jump location",
                  );
                  return; // Exit early, don't suggest jump.
                }
              } else {
                // Only one line and it matches.
                console.log(
                  "Skipping jump as content is identical at jump location",
                );
                return; // Exit early, don't suggest jump.
              }
            }
          }
        } catch (error) {
          console.error("Error checking content at jump location:", error);
          // Continue with jump even if there's an error checking content.
        }
      }
    }

    this._jumpInProgress = true;
    this._oldCursorPosition = currentPosition;

    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const visibleRanges = editor.visibleRanges;

      if (visibleRanges.length > 0) {
        const visibleRange = visibleRanges[0];
        const topLineNumber = visibleRange.start.line;
        const bottomLineNumber = visibleRange.end.line;

        const decorationLine = nextJumpLocation.line;

        // Check if jump location is outside the visible range.
        if (decorationLine < topLineNumber) {
          await this.renderTabToJumpDecoration(
            editor,
            topLineNumber,
            nextJumpLocation,
          );
        } else if (decorationLine > bottomLineNumber) {
          await this.renderTabToJumpDecoration(
            editor,
            bottomLineNumber,
            nextJumpLocation,
          );
        } else {
          // No suggestion is made when the decoration is within visibleRange.
          await this.renderTabToJumpDecoration(
            editor,
            decorationLine,
            nextJumpLocation,
          );
        }

        // Scroll to show the jump location.
        editor.revealRange(
          new vscode.Range(decorationLine, 0, decorationLine, 0),
          vscode.TextEditorRevealType.InCenter,
        );
      }
    }

    // Set up a way to detect when the jump is complete.
    const disposable = vscode.window.onDidChangeTextEditorSelection(() => {
      this._jumpInProgress = false;
      disposable.dispose();

      // If there's a completion waiting to be shown after the jump,
      // execute the command to show it.
      if (this._completionAfterJump) {
        vscode.commands.executeCommand(
          "continue.showNextEditAfterJump",
          this._completionAfterJump,
        );
        this._completionAfterJump = null;
      }
    });

    // Clean up after timeout if no jump has been made.
    setTimeout(() => {
      this._jumpInProgress = false;
      disposable.dispose();
    }, 5000);
  }

  private async renderTabToJumpDecoration(
    editor: vscode.TextEditor,
    lineToRenderOn: number,
    jumpPosition: vscode.Position,
  ) {
    // Clean up any existing decoration beforehand.
    await this.clearJumpDecoration();

    // Create a decoration for jump.
    this._jumpDecoration = vscode.window.createTextEditorDecorationType({
      before: {
        contentText: "🦘 Press Tab to jump, Esc to cancel",
        color: new vscode.ThemeColor("editorInfo.foreground"),
        backgroundColor: new vscode.ThemeColor("editorInfo.background"),
        margin: `0 0 0 4px`,
      },
    });

    // Apply the decoration.
    const lastIndexOfLine = editor.document.lineAt(lineToRenderOn).text.length;
    editor.setDecorations(this._jumpDecoration, [
      new vscode.Range(
        lineToRenderOn,
        lastIndexOfLine,
        lineToRenderOn,
        lastIndexOfLine,
      ),
    ]);

    // Set the context key to enable tab/esc shortcuts.
    await vscode.commands.executeCommand(
      "setContext",
      "continue.jumpDecorationVisible",
      true,
    );
    this._jumpDecorationVisible = true;

    // Register the key listeners.
    await this.registerKeyListeners(editor, jumpPosition);
  }

  private async clearJumpDecoration() {
    if (this._jumpDecoration) {
      this._jumpDecoration.dispose();
      this._jumpDecoration = undefined;
    }

    // Dispose any active listeners.
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];

    // Reset the context.
    await vscode.commands.executeCommand(
      "setContext",
      "continue.jumpDecorationVisible",
      false,
    );
    this._jumpDecorationVisible = false;
  }

  private async registerKeyListeners(
    editor: vscode.TextEditor,
    jumpPosition: vscode.Position,
  ) {
    const acceptJumpCommand = vscode.commands.registerCommand(
      "continue.acceptJump",
      async () => {
        if (this._jumpDecorationVisible) {
          // Move cursor to the jump position.
          editor.selection = new vscode.Selection(jumpPosition, jumpPosition);
          await this.clearJumpDecoration();
        }
      },
    );

    const rejectJumpCommand = vscode.commands.registerCommand(
      "continue.rejectJump",
      async () => {
        if (this._jumpDecorationVisible) {
          console.log(
            "deleteChain from JumpManager.ts: rejectJump and decoration visible",
          );
          NextEditProvider.getInstance().deleteChain();
          await this.clearJumpDecoration();
        }
      },
    );

    // Add a selection change listener to the editor to reject jump when cursor moves.
    const selectionChangeListener =
      vscode.window.onDidChangeTextEditorSelection((e) => {
        // If jump decoration isn't visible, nothing to do.
        if (!this._jumpDecorationVisible) {
          return;
        }

        const currentPosition = e.selections[0].active;

        // If cursor moved to jump position, this is likely the result of acceptJump.
        if (currentPosition.isEqual(jumpPosition)) {
          return;
        }

        // If cursor position changed for any other reason, reject the jump.
        if (
          this._oldCursorPosition &&
          !currentPosition.isEqual(this._oldCursorPosition)
        ) {
          vscode.commands.executeCommand("continue.rejectJump");
        }
      });

    // This allows us to dispose the command after a jump is completed.
    this._disposables.push(
      acceptJumpCommand,
      rejectJumpCommand,
      selectionChangeListener,
    );
  }

  isJumpInProgress(): boolean {
    return this._jumpInProgress;
  }

  setCompletionAfterJump(completionData: CompletionDataForAfterJump): void {
    this._completionAfterJump = completionData;
    console.log(
      "setCompletionAfterJump: saved",
      JSON.stringify(completionData, null, 2),
    );
  }
}
