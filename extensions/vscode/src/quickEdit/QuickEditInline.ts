/* eslint-disable @typescript-eslint/naming-convention */
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

class DecorationManager {
  private decorations: vscode.TextEditorDecorationType[] = [];
  private defaultLineHeight = 12;

  private static readonly BASE_STYLE: vscode.DecorationRenderOptions = {
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("input.background"),
    borderColor: new vscode.ThemeColor("input.border"),
    borderStyle: "solid",
    color: new vscode.ThemeColor("input.foreground"),
  };

  private static readonly BORDER_WIDTHS: Record<EditorLinePos, string> = {
    start: "2.5px 2.5px 0 2.5px",
    middle: "0 2.5px 0 2.5px",
    end: "0 2.5px 2.5px 2.5px",
  };

  constructor(private editor: vscode.TextEditor) {}

  updateDecorations(startLine: number, endLine: number) {
    this.disposeExistingDecorations();
    this.createBorderDecorations(startLine, endLine);
    this.createEnterButtonDecoration(startLine, endLine - startLine + 1);
  }

  private disposeExistingDecorations() {
    this.decorations.forEach((d) => d.dispose());
    this.decorations = [];
  }

  private createBorderDecorations(startLine: number, endLine: number) {
    for (let i = startLine; i <= endLine; i++) {
      const line = this.editor.document.lineAt(i);
      const linePos: EditorLinePos =
        i === startLine ? "start" : i === endLine ? "end" : "middle";
      const decoration = this.createBorderDecoration(linePos);
      this.editor.setDecorations(decoration, [line.range]);
      this.decorations.push(decoration);
    }
  }

  private createBorderDecoration(
    linePos: EditorLinePos,
  ): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      ...DecorationManager.BASE_STYLE,
      borderWidth: DecorationManager.BORDER_WIDTHS[linePos],
    });
  }

  private createEnterButtonDecoration(startLine: number, totalLines: number) {
    const enterRange = new vscode.Range(
      startLine,
      0,
      startLine,
      Number.MAX_SAFE_INTEGER,
    );
    const enterDecorator = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: "↵ Enter",
        color: new vscode.ThemeColor("foreground"),
        backgroundColor: new vscode.ThemeColor(
          "editorGroupHeader.tabsBackground",
        ),
        border: "none",
        margin: `${this.calculateTopMargin(totalLines)}px 0 0 65vw`,
        height: "22px",
      },
    });

    this.editor.setDecorations(enterDecorator, [{ range: enterRange }]);
    this.decorations.push(enterDecorator);
  }

  private calculateTopMargin(totalLines: number): number {
    const lineHeight = this.getLineHeight();
    const buttonHeight = 22;
    return lineHeight * (totalLines - 1) - buttonHeight / 2;
  }

  private getLineHeight(): number {
    return (
      vscode.workspace.getConfiguration("editor").get("lineHeight") ||
      vscode.workspace.getConfiguration("editor").get("fontSize") ||
      this.defaultLineHeight
    );
  }

  dispose() {
    this.disposeExistingDecorations();
  }
}

class SettingsManager {
  private originalSettings: Record<string, any> = {};

  async enableEditModeSettings() {
    const config = vscode.workspace.getConfiguration("workbench");
    const currentCustomizations = config.get("colorCustomizations") as Record<
      string,
      any
    >;

    // Store original settings
    this.originalSettings = {
      colorCustomizations: {
        "editorError.foreground":
          currentCustomizations["editorError.foreground"] || "",
        "editorWarning.foreground":
          currentCustomizations["editorWarning.foreground"] || "",
        "editorInfo.foreground":
          currentCustomizations["editorInfo.foreground"] || "",
        "editorOverviewRuler.errorForeground":
          currentCustomizations["editorOverviewRuler.errorForeground"] || "",
      },
    };

    // Set new settings
    await config.update(
      "colorCustomizations",
      {
        ...currentCustomizations,
        "editorError.foreground": "#00000000",
        "editorWarning.foreground": "#00000000",
        "editorInfo.foreground": "#00000000",
        "editorOverviewRuler.errorForeground": "#00000000",
      },
      vscode.ConfigurationTarget.Global,
    );
  }

  async restoreOriginalSettings() {
    const config = vscode.workspace.getConfiguration("workbench");
    const currentCustomizations = config.get("colorCustomizations") as Record<
      string,
      any
    >;

    // Restore original settings
    await config.update(
      "colorCustomizations",
      {
        ...currentCustomizations,
        ...this.originalSettings.colorCustomizations,
      },
      vscode.ConfigurationTarget.Global,
    );
  }
}

export default class QuickEditInline {
  private static quickEditors: QuickEditInline[] = [];
  private static commandTitle = "continue.isInQuickEdit";
  private static completionsProvider?: vscode.Disposable;
  private static settingsManager = new SettingsManager();

  private startLine: number;
  private endLine: number;
  private indentation: string;
  private decorationManager: DecorationManager;

  private numInitialLines = 3;

  constructor(
    private readonly editor: vscode.TextEditor,
    private readonly initialCursorPos: vscode.Position,
  ) {
    this.startLine = initialCursorPos.line;
    this.endLine = initialCursorPos.line;
    this.indentation = this.getIndentation();
    this.decorationManager = new DecorationManager(editor);

    this.init();
  }

  static async add() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      console.debug("No active text editor");
      return;
    }

    if (QuickEditInline.quickEditors.length === 0) {
      QuickEditInline.setIsInQuickEdit(true);

      await QuickEditInline.settingsManager.enableEditModeSettings();

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

  private static async setIsInQuickEdit(isInQuickEdit: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      QuickEditInline.commandTitle,
      isInQuickEdit,
    );

    if (!isInQuickEdit) {
      await QuickEditInline.settingsManager.restoreOriginalSettings();
    }
  }

  private async cleanup() {
    this.decorationManager.dispose();

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
    this.decorationManager.updateDecorations(this.startLine, this.endLine);
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
