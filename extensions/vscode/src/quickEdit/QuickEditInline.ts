import * as vscode from "vscode";

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

  decorator = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "white",
    color: "green",
  });

  startLine: number;
  endLine: number;
  indentation: string;

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

  private moveCursor(line: number, character: number) {
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
    this.decorator.dispose();
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

  private updateCursorAndDecoration(newLine: number, character: number) {
    this.moveCursor(newLine, character);
    this.endLine = newLine;
    this.updateDecoration();
  }

  private updateDecoration() {
    const range = new vscode.Range(
      this.startLine,
      0,
      this.endLine,
      this.editor.document.lineAt(this.endLine).range.end.character,
    );
    this.editor.setDecorations(this.decorator, [range]);
  }

  private isNewlineText(event: vscode.TextDocumentChangeEvent): boolean {
    const pressedKey = event.contentChanges[0]?.text;
    const newlineRegexCmd = /\n/;
    return newlineRegexCmd.test(pressedKey);
  }

  private async addQuickEditorLine() {
    await this.editor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(this.initialCursorPos.line, 0),
        `${this.indentation}\n`,
      );
    });

    this.updateCursorAndDecoration(
      this.initialCursorPos.line,
      this.indentation.length,
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
      this.updateCursorAndDecoration(
        cursorPos.line + 1,
        this.indentation.length,
      );
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
      await this.addQuickEditorLine();
      this.setupOnNewlineListener();
    } catch (error: any) {
      vscode.window.showErrorMessage(
        "Error inserting new line: " + error.message,
      );
    }
  }
}
