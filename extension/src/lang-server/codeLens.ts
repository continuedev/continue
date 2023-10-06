import * as vscode from "vscode";
import { editorToSuggestions, editorSuggestionsLocked } from "../suggestions";
import * as path from "path";
import * as os from "os";
import { DIFF_DIRECTORY, diffManager } from "../diffs";
import { getMetaKeyLabel } from "../util/util";
import { debugPanelWebview } from "../debugPanel";
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
            title: `(${getMetaKeyLabel()}⇧↩/${getMetaKeyLabel()}⇧⌫ to accept/reject all)`,
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
          title: `Accept All ✅ (${getMetaKeyLabel()}⇧↩)`,
          command: "continue.acceptDiff",
          arguments: [document.uri.fsPath],
        }),
        new vscode.CodeLens(range, {
          title: `Reject All ❌ (${getMetaKeyLabel()}⇧⌫)`,
          command: "continue.rejectDiff",
          arguments: [document.uri.fsPath],
        }),
        new vscode.CodeLens(range, {
          title: `Further Edit ✏️ (${getMetaKeyLabel()}⇧M)`,
          command: "continue.focusContinueInputWithEdit",
        })
      );
      return codeLenses;
    } else {
      return [];
    }
  }
}

class ConfigPyCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    if (
      !document.uri.fsPath.endsWith(".continue/config.py") &&
      !document.uri.fsPath.endsWith(".continue\\config.py")
    ) {
      return codeLenses;
    }

    const lines = document.getText().split(os.EOL);
    const lineOfModels = lines.findIndex((line) =>
      line.includes("models=Models(")
    );

    if (lineOfModels >= 0) {
      const range = new vscode.Range(lineOfModels, 0, lineOfModels + 1, 0);
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `+ Add a Model`,
          command: "continue.addModel",
        })
      );
    }

    const lineOfSystemMessage = lines.findIndex((line) =>
      line.replace(" ", "").includes("config=ContinueConfig(")
    );

    if (lineOfSystemMessage >= 0) {
      const range = new vscode.Range(
        lineOfSystemMessage,
        0,
        lineOfSystemMessage + 1,
        0
      );
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `✏️ Edit in UI`,
          command: "continue.openSettingsUI",
        })
      );
    }

    return codeLenses;
  }
}

let diffsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let suggestionsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let configPyCodeLensDisposable: vscode.Disposable | undefined = undefined;

export function registerAllCodeLensProviders(context: vscode.ExtensionContext) {
  if (suggestionsCodeLensDisposable) {
    suggestionsCodeLensDisposable.dispose();
  }
  if (diffsCodeLensDisposable) {
    diffsCodeLensDisposable.dispose();
  }
  if (configPyCodeLensDisposable) {
    configPyCodeLensDisposable.dispose();
  }
  suggestionsCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new SuggestionsCodeLensProvider()
  );
  diffsCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new DiffViewerCodeLensProvider()
  );
  configPyCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new ConfigPyCodeLensProvider()
  );
  context.subscriptions.push(suggestionsCodeLensDisposable);
  context.subscriptions.push(diffsCodeLensDisposable);
  context.subscriptions.push(configPyCodeLensDisposable);
}
