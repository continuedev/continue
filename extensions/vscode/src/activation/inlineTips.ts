import * as vscode from "vscode";
import { getMetaKeyLabel } from "../util/util";

const inlineTipDecoration = vscode.window.createTextEditorDecorationType({
  after: {
    contentText: `${getMetaKeyLabel()} M to select code, ${getMetaKeyLabel()} ⇧ L to edit`,
    color: "#888",
    margin: "0 0 0 6em",
    fontWeight: "bold",
  },
});

function handleSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
  const selection = e.selections[0];
  const editor = e.textEditor;

  if (editor.document.uri.toString() === "output:tasks") {
    return;
  }

  if (
    selection.isEmpty ||
    vscode.workspace
      .getConfiguration("continue")
      .get<boolean>("showInlineTip") === false
  ) {
    editor.setDecorations(inlineTipDecoration, []);
    return;
  }

  const line = Math.max(0, selection.start.line - 1);

  const hoverMarkdown = new vscode.MarkdownString(
    `Use ${getMetaKeyLabel()} M to select code, or ${getMetaKeyLabel()} ⇧ L to edit highlighted code. Click [here](command:continue.hideInlineTip) if you don't want to see these inline suggestions.`
  );
  hoverMarkdown.isTrusted = true;
  hoverMarkdown.supportHtml = true;
  editor.setDecorations(inlineTipDecoration, [
    {
      range: new vscode.Range(
        new vscode.Position(line, Number.MAX_VALUE),
        new vscode.Position(line, Number.MAX_VALUE)
      ),
      hoverMessage: [hoverMarkdown],
    },
  ]);
}

const emptyFileTooltipDecoration = vscode.window.createTextEditorDecorationType(
  {
    after: {
      contentText: `Use ${getMetaKeyLabel()} ⇧ L to generate code`,
      color: "#888",
      margin: "2em 0 0 0",
      fontStyle: "italic",
    },
  }
);

let selectionChangeDebounceTimer: NodeJS.Timeout | undefined;

export function setupInlineTips(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (selectionChangeDebounceTimer) {
        clearTimeout(selectionChangeDebounceTimer);
      }
      selectionChangeDebounceTimer = setTimeout(() => {
        handleSelectionChange(e);
      }, 200);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.getText() === "") {
        if (editor.document.uri.toString() === "output:tasks") {
          return;
        }

        editor.setDecorations(emptyFileTooltipDecoration, [
          {
            range: new vscode.Range(
              new vscode.Position(0, Number.MAX_VALUE),
              new vscode.Position(0, Number.MAX_VALUE)
            ),
          },
        ]);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.getText() === "") {
        vscode.window.visibleTextEditors.forEach((editor) => {
          editor.setDecorations(emptyFileTooltipDecoration, [
            {
              range: new vscode.Range(
                new vscode.Position(0, Number.MAX_VALUE),
                new vscode.Position(0, Number.MAX_VALUE)
              ),
            },
          ]);
        });
      } else {
        vscode.window.visibleTextEditors.forEach((editor) => {
          editor.setDecorations(emptyFileTooltipDecoration, []);
        });
      }
    })
  );
}
