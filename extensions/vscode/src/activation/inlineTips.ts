import * as vscode from "vscode";

const inlineTipDecoration = vscode.window.createTextEditorDecorationType({
  after: {
    contentText: "⌘ M to select code, ⌘ ⇧ M to edit",
    color: "#d3d3d340",
    margin: "0 0 0 6em",
  },
});

function handleSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
  const selection = e.selections[0];
  const editor = e.textEditor;
  if (
    selection.isEmpty ||
    vscode.workspace
      .getConfiguration("continue")
      .get<boolean>("showInlineTip") === false
  ) {
    editor.setDecorations(inlineTipDecoration, []);
    return;
  }

  const startLine = selection.start.line;

  let lineToShow = startLine > 0 ? startLine - 1 : startLine + 1;

  const hoverMarkdown = new vscode.MarkdownString(
    "Use ⌘ M to select code, or ⌘ ⇧ M to select code and use the /edit slash command. Click [here](command:continue.hideInlineTip) if you don't want to see these inline suggestions."
  );
  hoverMarkdown.isTrusted = true;
  hoverMarkdown.supportHtml = true;
  editor.setDecorations(inlineTipDecoration, [
    {
      range: new vscode.Range(
        new vscode.Position(lineToShow, Number.MAX_VALUE),
        new vscode.Position(lineToShow, Number.MAX_VALUE)
      ),
      hoverMessage: [hoverMarkdown],
    },
  ]);
}

export function setupInlineTips(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(handleSelectionChange)
  );
}
