import * as vscode from "vscode";
import * as os from "os";

export class ConfigPyCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    if (
      !document.uri.fsPath.endsWith(".continue/config.json") &&
      !document.uri.fsPath.endsWith(".continue\\config.json")
    ) {
      return codeLenses;
    }

    const lines = document.getText().split(os.EOL);
    const lineOfModels = lines.findIndex((line) =>
      line.includes('"models": ['),
    );

    const lineOfSystemMessage = lines.findIndex((line) =>
      line.includes("ContinueConfig("),
    );

    if (lineOfSystemMessage >= 0) {
      const range = new vscode.Range(
        lineOfSystemMessage,
        0,
        lineOfSystemMessage + 1,
        0,
      );
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "✏️ Edit in UI",
          command: "continue.openSettingsUI",
        }),
      );
    }

    return codeLenses;
  }
}
