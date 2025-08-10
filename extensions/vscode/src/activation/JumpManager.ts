import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { NextEditOutcome } from "core/nextEdit/types";
import * as vscode from "vscode";
import {
  HandlerPriority,
  SelectionChangeManager,
} from "./SelectionChangeManager";

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
  private _jumpAccepted: boolean = false;
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
    this._disposables.forEach((d) => {
      if (d) d.dispose();
    });
    this._disposables = [];
  }

  public async suggestJump(
    currentPosition: vscode.Position,
    nextJumpLocation: vscode.Position,
    completionContent?: string,
  ): Promise<boolean> {
    // Deduplication logic.
    // If the content at the next jump location is
    // identical to the completion content,
    // then we don't have to jump.
    if (completionContent !== undefined) {
      console.log("completionContent is not null");
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        try {
          const completionLines = completionContent.split("\n");
          console.log("completionLines:", completionLines);

          // Get document content at jump location spanning multiple lines.
          const document = editor.document;
          const startLine = nextJumpLocation.line;
          const endLine = Math.min(
            startLine + completionLines.length - 1,
            document.lineCount - 1,
          );

          // First check if we have enough lines in the document
          if (endLine - startLine + 1 < completionLines.length) {
            // Not enough lines in document, so content can't be identical.
            // Proceed to jump!
            console.log(
              "Not enough lines in document to match completion content",
            );
          } else {
            let contentMatches = true;

            // Check all lines for match.
            for (let i = 0; i < completionLines.length && contentMatches; i++) {
              const documentLine = startLine + i;
              const lineText = document.lineAt(documentLine).text;
              if (lineText !== completionLines[i]) {
                contentMatches = false;
                console.log(`Line ${i + 1} doesn't match`);
              }
            }

            if (contentMatches) {
              console.log(
                "Skipping jump as content is identical at jump location",
              );
              return false; // Exit early, don't suggest jump.
            }
          }
        } catch (error) {
          console.error("Error checking content at jump location:", error);
          // Continue with jump even if there's an error checking content.
        }
      }
    }

    console.log("this._jumpInProgress");
    this._jumpInProgress = true;
    this._oldCursorPosition = currentPosition;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log("No active editor, cannot suggest jump");
      this._jumpInProgress = false;
      return false;
    }

    const visibleRanges = editor.visibleRanges;
    if (visibleRanges.length === 0) {
      console.log("No visible ranges in editor, cannot suggest jump");
      this._jumpInProgress = false;
      return false;
    }

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

    // Clean up after timeout if no jump has been made.
    // setTimeout(() => {
    //   this._jumpInProgress = false;
    // }, 10000);

    return true;
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
        contentText: "📍 Press Tab to jump, Esc to cancel",
        color: new vscode.ThemeColor("editor.foreground"),
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
    this.dispose();

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
          this._jumpAccepted = true;

          // Move cursor to the jump position.
          editor.selection = new vscode.Selection(jumpPosition, jumpPosition);
          await this.clearJumpDecoration();

          this._jumpAccepted = false;
          vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
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

  setJumpInProgress(jumpInProgress: boolean) {
    this._jumpInProgress = jumpInProgress;
  }

  wasJumpJustAccepted(): boolean {
    return this._jumpAccepted;
  }

  setCompletionAfterJump(completionData: CompletionDataForAfterJump): void {
    this._completionAfterJump = completionData;
  }

  clearCompletionAfterJump(): void {
    this._completionAfterJump = null;
  }

  get completionAfterJump() {
    return this._completionAfterJump;
  }

  public registerSelectionChangeHandler(): void {
    const manager = SelectionChangeManager.getInstance();

    manager.registerListener(
      "jumpManager",
      async (e, state) => {
        if (state.jumpInProgress || state.jumpJustAccepted) {
          console.log(
            "JumpManager: jump in progress or just accepted, preserving chain",
          );
          return true;
        }

        return false;
      },
      HandlerPriority.HIGH,
    );
  }
}
