import * as vscode from "vscode";

class ContinueQuickFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    if (context.diagnostics.length === 0) {
      return [];
    }

    const createQuickFix = (edit: boolean) => {
      const diagnostic = context.diagnostics[0];
      const quickFix = new vscode.CodeAction(
        edit ? "Fix with Continue" : "Ask Continue",
        vscode.CodeActionKind.QuickFix,
      );
      quickFix.isPreferred = false;
      const surroundingRange = new vscode.Range(
        Math.max(0, range.start.line - 3),
        0,
        Math.min(document.lineCount, range.end.line + 3),
        0,
      );
      quickFix.command = {
        command: "continue.quickFix",
        title: "Continue Quick Fix",
        arguments: [
          diagnostic.message,
          document.getText(surroundingRange),
          edit,
        ],
      };
      return quickFix;
    };
    return [
      // createQuickFix(true),
      createQuickFix(false),
    ];
  }
}

export default function registerQuickFixProvider() {
  // In your extension's activate function:
  vscode.languages.registerCodeActionsProvider(
    { language: "*" },
    new ContinueQuickFixProvider(),
    {
      providedCodeActionKinds: ContinueQuickFixProvider.providedCodeActionKinds,
    },
  );
}
