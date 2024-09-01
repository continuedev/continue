import * as vscode from "vscode";

type EditorLinePos = "start" | "middle" | "end";

class ContextCompletionItemProvider implements vscode.CompletionItemProvider {
  contextProviderChar = "@";

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<
    vscode.CompletionList<vscode.CompletionItem> | vscode.CompletionItem[]
  > {
    const charBeforeCursor = document.getText(
      new vscode.Range(
        position.with(undefined, position.character - 1),
        position,
      ),
    );

    if (charBeforeCursor === this.contextProviderChar) {
      return [
        {
          label: "customContext",
          kind: vscode.CompletionItemKind.Text,
          detail: "customContext",
          insertText: "customContext",
          range: new vscode.Range(position, position),
          sortText: "00000000000000000",
        },
      ];
    }

    return [];
  }
}

export default class QuickEditInline {
  static quickEditors: QuickEditInline[] = [];
  static completionsProvider?: vscode.Disposable;

  private startLine: number;
  private endLine: number;
  private indentation: string;

  private decorations: vscode.TextEditorDecorationType[] = [];
  private editorBaseStyle: vscode.DecorationRenderOptions = {
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("input.background"),
    borderColor: new vscode.ThemeColor("input.border"),
    borderStyle: "solid",
    borderWidth: "2.5px 2.5px 0 2.5px",
    color: new vscode.ThemeColor("input.foreground"),
  };
  private enterButtonStyle: vscode.DecorationRenderOptions = {
    after: {
      contentText: "⏎", // Unicode for the enter symbol
      color: new vscode.ThemeColor("editorLink.activeForeground"),
      margin: "0 0 0 1em",
    },
  };

  // We create three initial lines since a single line
  // is too tight
  private numInitialLines = 3;

  constructor(
    private readonly editor: vscode.TextEditor,
    private readonly initialCursorPos: vscode.Position,
  ) {
    this.startLine = initialCursorPos.line;
    this.endLine = initialCursorPos.line;
    this.indentation = this.getIndentation();

    this.init();
  }

  static add() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      console.debug("No active text editor");
      return;
    }

    if (QuickEditInline.quickEditors.length === 0) {
      QuickEditInline.setIsInQuickEdit(true);

      QuickEditInline.completionsProvider =
        vscode.languages.registerCompletionItemProvider(
          editor.document.uri,
          new ContextCompletionItemProvider(),
          "@",
        );
    }

    const initialCursorPos = editor.selection.active;
    const quickEditor = new QuickEditInline(editor, initialCursorPos);

    QuickEditInline.quickEditors.push(quickEditor);
  }

  static async remove() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      console.debug("No active text editor");
      return;
    }

    const cursorLine = editor.selection.active.line;

    const quickEditor = QuickEditInline.quickEditors.find((quickEditor) =>
      quickEditor.containsLine(cursorLine),
    );

    if (quickEditor) {
      await quickEditor.cleanup();
    } else {
      console.debug("No quick editor found");
    }
  }

  private async removeQuickEditorLines() {
    const didCompleteEdit = await this.editor.edit((editBuilder) => {
      const range = new vscode.Range(this.startLine, 0, this.endLine + 1, 0);
      editBuilder.delete(range);
    });

    if (!didCompleteEdit) {
      console.debug(
        `Failed to remove quick editor lines: ${this.startLine}-${this.endLine}`,
      );
    }
  }

  private moveCursor(
    line: number,
    character: number = this.indentation.length,
  ) {
    const pos = new vscode.Position(line, character);
    this.editor.selection = new vscode.Selection(pos, pos);
  }

  private static setIsInQuickEdit(isInQuickEdit: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      "continue.isInQuickEdit",
      isInQuickEdit,
    );
  }

  private async cleanup() {
    // this.decorator?.dispose();
    this.decorations.forEach((d) => d.dispose());

    await this.removeQuickEditorLines();
    this.moveCursor(
      this.initialCursorPos.line,
      this.initialCursorPos.character,
    );

    QuickEditInline.quickEditors = QuickEditInline.quickEditors.filter(
      (e) => e !== this,
    );

    if (QuickEditInline.quickEditors.length === 0) {
      QuickEditInline.setIsInQuickEdit(false);
      QuickEditInline.completionsProvider?.dispose();
    }
  }

  private getIndentation() {
    const lineText = this.editor.document.lineAt(
      this.initialCursorPos.line,
    ).text;
    const indentMatch = lineText.match(/^\s*/);
    return indentMatch ? indentMatch[0] : "";
  }

  private updateCursorAndDecoration(newEndLine: number, cursorLine: number) {
    this.moveCursor(cursorLine);
    this.endLine = newEndLine;
    this.updateDecorations();
  }

  private createBorderDecoration(line: EditorLinePos) {
    const borderWidths: Record<EditorLinePos, string> = {
      start: "2.5px 2.5px 0 2.5px",
      middle: "0 2.5px 0 2.5px",
      end: "0 2.5px 2.5px 2.5px",
    };

    return vscode.window.createTextEditorDecorationType({
      ...this.editorBaseStyle,
      borderWidth: borderWidths[line],
    });
  }

  private updateDecorations() {
    this.disposeExistingDecorations();
    this.createEnterButtonDecoration();
    this.createEditorLinesDecorations();
  }

  private disposeExistingDecorations() {
    this.decorations.forEach((d) => d.dispose());
    this.decorations = [];
  }

  private createEnterButtonDecoration() {
    // We use the start line because of issues applying a
    // bottom margin. Otherwise it would be simpler just
    // to use the endLine, since we align the enter button
    // to the last line of text.
    const enterRange = new vscode.Range(
      this.startLine,
      0,
      this.startLine,
      Number.MAX_SAFE_INTEGER,
    );

    const enterDecorator = vscode.window.createTextEditorDecorationType(
      this.enterButtonStyle,
    );

    this.decorations.push(enterDecorator);
    this.editor.setDecorations(enterDecorator, [
      this.getEnterButtonRenderOptions(enterRange),
    ]);
  }

  private getEnterButtonRenderOptions(
    range: vscode.Range,
  ): vscode.DecorationOptions {
    const lineHeight = this.getLineHeight();
    const height = 22;
    return {
      range,
      renderOptions: {
        after: {
          contentText: "↵ Enter",
          color: new vscode.ThemeColor("foreground"),
          backgroundColor: new vscode.ThemeColor(
            "editorGroupHeader.tabsBackground",
          ),
          border: "none",
          margin: `${this.calculateTopMargin(lineHeight, height)}px 0 0 65vw`,
          height: `${height}px`,
        },
      },
    };
  }

  private getLineHeight(): number {
    return (vscode.workspace.getConfiguration("editor").get("lineHeight") ||
      vscode.workspace.getConfiguration("editor").get("fontSize"))!;
  }

  private calculateTopMargin(lineHeight: number, height: number): number {
    return lineHeight * (this.endLine - this.startLine) - height / 2;
  }

  private createEditorLinesDecorations() {
    const decorations: [vscode.Range, vscode.TextEditorDecorationType][] = [];

    for (let i = this.startLine; i <= this.endLine; i++) {
      const line = this.editor.document.lineAt(i);
      const decoration = this.createBorderDecorationForLine(i);
      this.decorations.push(decoration);
      decorations.push([line.range, decoration]);
    }

    this.applyRangeDecorations(decorations);
  }

  private createBorderDecorationForLine(
    lineNumber: number,
  ): vscode.TextEditorDecorationType {
    if (lineNumber === this.startLine) {
      return this.createBorderDecoration("start");
    } else if (lineNumber === this.endLine) {
      return this.createBorderDecoration("end");
    } else {
      return this.createBorderDecoration("middle");
    }
  }

  private applyRangeDecorations(
    decorations: [vscode.Range, vscode.TextEditorDecorationType][],
  ) {
    decorations.forEach(([range, decoration]) => {
      this.editor.setDecorations(decoration, [range]);
    });
  }

  private isNewlineText(event: vscode.TextDocumentChangeEvent): boolean {
    const pressedKey = event.contentChanges[0]?.text;
    const newlineRegexCmd = /\n/;
    return newlineRegexCmd.test(pressedKey);
  }

  private async addInitialQuickEditorLines() {
    const threeNewLines = `${this.indentation}\n`.repeat(this.numInitialLines);

    await this.editor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(this.initialCursorPos.line, 0),
        threeNewLines,
      );
    });

    this.updateCursorAndDecoration(
      this.initialCursorPos.line + 2,
      this.initialCursorPos.line + 1,
    );
  }

  private setupOnNewlineListener() {
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (
        event.document !== this.editor.document ||
        !this.isNewlineText(event) ||
        !this.isCursorInQuickEditor()
      ) {
        return;
      }

      const cursorPos = this.editor.selection.active;
      this.updateCursorAndDecoration(this.endLine + 1, cursorPos.line + 1);
    });
  }

  private isCursorInQuickEditor() {
    const cursorLine = this.editor.selection.active.line;
    return this.containsLine(cursorLine);
  }

  private containsLine(line: number): boolean {
    return line >= this.startLine && line <= this.endLine;
  }

  private async init() {
    try {
      await this.addInitialQuickEditorLines();
      this.setupOnNewlineListener();
    } catch (error: any) {
      vscode.window.showErrorMessage(
        "Error inserting new line: " + error.message,
      );
    }
  }
}
