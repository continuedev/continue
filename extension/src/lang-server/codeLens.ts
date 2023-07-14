import * as vscode from "vscode";
import { editorToSuggestions, editorSuggestionsLocked } from "../suggestions";
import * as path from "path";
import * as os from "os";
import { DIFF_DIRECTORY, diffManager } from "../diffs";
class SuggestionsCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const suggestions = editorToSuggestions.get(document.uri.toString());
    if (!suggestions) {
      return [];
    }
    const locked = editorSuggestionsLocked.get(document.uri.fsPath.toString());

    const codeLenses: vscode.CodeLens[] = [];
    for (const suggestion of suggestions) {
      const range = new vscode.Range(
        suggestion.oldRange.start,
        suggestion.newRange.end
      );
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Accept ✅",
          command: "continue.acceptSuggestion",
          arguments: [suggestion],
        }),
        new vscode.CodeLens(range, {
          title: "Reject ❌",
          command: "continue.rejectSuggestion",
          arguments: [suggestion],
        })
      );
      if (codeLenses.length === 2) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "(⌘⇧↩/⌘⇧⌫ to accept/reject all)",
            command: "",
          })
        );
      }
    }

    return codeLenses;
  }
}

class DiffViewerCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (path.dirname(document.uri.fsPath) === DIFF_DIRECTORY) {
      const codeLenses: vscode.CodeLens[] = [];
      let range = new vscode.Range(0, 0, 1, 0);
      const diffInfo = diffManager.diffAtNewFilepath(document.uri.fsPath);
      if (diffInfo) {
        range = diffInfo.range;
      }
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Accept All ✅ (⌘⇧↩)",
          command: "continue.acceptDiff",
          arguments: [document.uri.fsPath],
        }),
        new vscode.CodeLens(range, {
          title: "Reject All ❌ (⌘⇧⌫)",
          command: "continue.rejectDiff",
          arguments: [document.uri.fsPath],
        })
      );
      return codeLenses;
    } else {
      return [];
    }
  }
}

let diffsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let suggestionsCodeLensDisposable: vscode.Disposable | undefined = undefined;

export function registerAllCodeLensProviders(context: vscode.ExtensionContext) {
  if (suggestionsCodeLensDisposable) {
    suggestionsCodeLensDisposable.dispose();
  }
  if (diffsCodeLensDisposable) {
    diffsCodeLensDisposable.dispose();
  }
  suggestionsCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new SuggestionsCodeLensProvider()
  );
  diffsCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new DiffViewerCodeLensProvider()
  );
  context.subscriptions.push(suggestionsCodeLensDisposable);
  context.subscriptions.push(diffsCodeLensDisposable);
}
