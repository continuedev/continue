import vscode from "vscode";
class EditDecorationManager {
  private _lastEditor: vscode.TextEditor | undefined;
  private decorationType: vscode.TextEditorDecorationType;

  constructor(context: vscode.ExtensionContext) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor(
        // "editor.selectionHighlightBackground" requires partial transparency.
        // This ensures the highlight does not completely obscure the selection,
        // making it useful for repurposing here.
        "editor.selectionHighlightBackground",
      ),
      isWholeLine: true,
    });
  }

  private updateInEditMode(inEditMode: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      "continue.inEditMode",
      inEditMode,
    );
  }

  setDecoration(editor: vscode.TextEditor, range: vscode.Range) {
    if (this._lastEditor) {
      this._lastEditor.setDecorations(this.decorationType, []);
    }
    editor.setDecorations(this.decorationType, [range]);
    this._lastEditor = editor;
    this.updateInEditMode(true);
  }

  clear() {
    if (this._lastEditor) {
      this._lastEditor.setDecorations(this.decorationType, []);
      this._lastEditor = undefined;
      this.updateInEditMode(false);
    }
  }
}
export default EditDecorationManager;
