import path from "path";
import * as vscode from "vscode";
import { DiffManager, DIFF_DIRECTORY } from "../../../diff/horizontal";
import { getMetaKeyLabel } from "../../../util/util";

export class DiffViewerCodeLensProvider implements vscode.CodeLensProvider {
  diffManager: DiffManager;

  constructor(diffManager: DiffManager) {
    this.diffManager = diffManager;
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (path.dirname(document.uri.fsPath) === DIFF_DIRECTORY) {
      const codeLenses: vscode.CodeLens[] = [];
      let range = new vscode.Range(0, 0, 1, 0);
      const diffInfo = this.diffManager.diffAtNewFilepath(document.uri.fsPath);
      if (diffInfo) {
        range = diffInfo.range;
      }
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `Accept All ✅ (${getMetaKeyLabel()}⇧⏎)`,
          command: "continue.acceptDiff",
          arguments: [document.uri.fsPath],
        }),
        new vscode.CodeLens(range, {
          title: `Reject All ❌ (${getMetaKeyLabel()}⇧⌫)`,
          command: "continue.rejectDiff",
          arguments: [document.uri.fsPath],
        }),
      );
      return codeLenses;
    } else {
      return [];
    }
  }
}
