import { EXTENSION_NAME } from "core/control-plane/env";
import * as vscode from "vscode";
import { getMetaKeyName } from "../util/util";

const inlineTipDecoration = vscode.window.createTextEditorDecorationType({
  after: {
    contentText: `Add to chat (${getMetaKeyName()}+L) | Edit highlighted code (${getMetaKeyName()}+I).`,
    color: "#888",
    margin: "0 0 0 6em",
    fontWeight: "bold",
  },
});

function showInlineTip() {
  return vscode.workspace
    .getConfiguration(EXTENSION_NAME)
    .get<boolean>("showInlineTip");
}

function handleSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
  const selection = e.selections[0];
  const editor = e.textEditor;

  if (editor.document.uri.toString().startsWith("output:")) {
    return;
  }

  if (selection.isEmpty || showInlineTip() === false) {
    editor.setDecorations(inlineTipDecoration, []);
    return;
  }

  const line = Math.max(0, selection.start.line - 1);

  const hoverMarkdown = new vscode.MarkdownString(
    `Click [here](command:continue.hideInlineTip) to hide these suggestions`,
  );
  hoverMarkdown.isTrusted = true;
  hoverMarkdown.supportHtml = true;
  editor.setDecorations(inlineTipDecoration, [
    {
      range: new vscode.Range(
        new vscode.Position(line, Number.MAX_VALUE),
        new vscode.Position(line, Number.MAX_VALUE),
      ),
      hoverMessage: [hoverMarkdown],
    },
  ]);
}

const emptyFileTooltipDecoration = vscode.window.createTextEditorDecorationType(
  {
    after: {
      contentText: `Use ${getMetaKeyName()}+I to generate code`,
      color: "#888",
      margin: "2em 0 0 0",
      fontStyle: "italic",
    },
  },
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
    }),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.getText() === "" && showInlineTip() === true) {
        if (
          editor.document.uri.toString().startsWith("output:") ||
          editor.document.uri.scheme === "comment"
        ) {
          return;
        }

        editor.setDecorations(emptyFileTooltipDecoration, [
          {
            range: new vscode.Range(
              new vscode.Position(0, Number.MAX_VALUE),
              new vscode.Position(0, Number.MAX_VALUE),
            ),
          },
        ]);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString().startsWith("vscode://inline-chat")) {
        return;
      }
      if (e.document.getText() === "" && showInlineTip() === true) {
        vscode.window.visibleTextEditors.forEach((editor) => {
          editor.setDecorations(emptyFileTooltipDecoration, [
            {
              range: new vscode.Range(
                new vscode.Position(0, Number.MAX_VALUE),
                new vscode.Position(0, Number.MAX_VALUE),
              ),
            },
          ]);
        });
      } else {
        vscode.window.visibleTextEditors.forEach((editor) => {
          editor.setDecorations(emptyFileTooltipDecoration, []);
        });
      }
    }),
  );
}
