import * as vscode from "vscode";

export class JumpManager {
  private static _instance: JumpManager | undefined;

  // Decoration state.
  private _jumpDecoration: vscode.TextEditorDecorationType | undefined;
  private _jumpDecorationVisible = false;
  private _disposables: vscode.Disposable[] = [];

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

  public async suggestJump(nextJumpLocation: vscode.Position) {
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
          return;
        }

        // Scroll to show the jump location.
        editor.revealRange(
          new vscode.Range(decorationLine, 0, decorationLine, 0),
          vscode.TextEditorRevealType.InCenter,
        );
      }
    }
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
        contentText: "📌 Press Tab to jump, Esc to cancel",
        color: new vscode.ThemeColor("editorInfo.foreground"),
        backgroundColor: new vscode.ThemeColor("editorInfo.background"),
        margin: "0 0 0 0",
      },
      isWholeLine: true,
    });

    // Apply the decoration.
    editor.setDecorations(this._jumpDecoration, [
      new vscode.Range(lineToRenderOn, 0, lineToRenderOn, 0),
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
          await this.clearJumpDecoration();
        }
      },
    );

    // This allows us to dispose the command after a jump is completed.
    this._disposables.push(acceptJumpCommand, rejectJumpCommand);
  }
}
