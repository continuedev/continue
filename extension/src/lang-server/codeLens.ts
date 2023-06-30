import * as vscode from "vscode";
import { editorToSuggestions, editorSuggestionsLocked } from "../suggestions";

class SuggestionsCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
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
          command: locked ? "" : "continue.acceptSuggestion",
          arguments: [suggestion],
        }),
        new vscode.CodeLens(range, {
          title: "Reject ❌",
          command: locked ? "" : "continue.rejectSuggestion",
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

  onDidChangeCodeLenses?: vscode.Event<void> | undefined;

  constructor(emitter?: vscode.EventEmitter<void>) {
    if (emitter) {
      this.onDidChangeCodeLenses = emitter.event;
      this.onDidChangeCodeLenses(() => {
        if (vscode.window.activeTextEditor) {
          this.provideCodeLenses(
            vscode.window.activeTextEditor.document,
            new vscode.CancellationTokenSource().token
          );
        }
      });
    }
  }
}

const allCodeLensProviders: { [langauge: string]: vscode.CodeLensProvider[] } =
  {
    // python: [new SuggestionsCodeLensProvider(), new PytestCodeLensProvider()],
    "*": [new SuggestionsCodeLensProvider()],
  };

export function registerAllCodeLensProviders(context: vscode.ExtensionContext) {
  for (const language in allCodeLensProviders) {
    for (const codeLensProvider of allCodeLensProviders[language]) {
      context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(language, codeLensProvider)
      );
    }
  }
}
