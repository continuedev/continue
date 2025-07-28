import * as vscode from "vscode";

export class DownloadYamlExtensionCodeLensProvider
  implements vscode.CodeLensProvider
{
  private yamlExtensionDownloaded(): boolean {
    const yamlExtension = vscode.extensions.getExtension("redhat.vscode-yaml");
    return yamlExtension !== undefined;
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!document.uri.fsPath.includes(".continue")) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    // Always show documentation link
    const docCodeLens: vscode.CodeLens = {
      range: new vscode.Range(0, 0, 0, 0),
      command: {
        title: "📖 View Continue Reference",
        command: "vscode.open",
        arguments: [vscode.Uri.parse("https://docs.continue.dev/reference")],
      },
      isResolved: true,
    };
    codeLenses.push(docCodeLens);

    if (!this.yamlExtensionDownloaded()) {
      const codeLens: vscode.CodeLens = {
        range: new vscode.Range(0, 0, 0, 0),
        command: {
          title: "Download YAML extension for Intellisense",
          command: "workbench.extensions.installExtension",
          arguments: ["redhat.vscode-yaml"],
        },
        isResolved: true,
      };
      codeLenses.push(codeLens);
    }

    return codeLenses;
  }
}
