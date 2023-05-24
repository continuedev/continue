import * as vscode from "vscode";
import { getLanguageLibrary } from "../languages";
import { editorToSuggestions } from "../suggestions";

class SuggestionsCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    let suggestions = editorToSuggestions.get(document.uri.toString());
    if (!suggestions) {
      return [];
    }

    let codeLenses: vscode.CodeLens[] = [];
    for (let suggestion of suggestions) {
      let range = new vscode.Range(
        suggestion.oldRange.start,
        suggestion.newRange.end
      );
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Accept",
          command: "continue.acceptSuggestion",
          arguments: [suggestion],
        }),
        new vscode.CodeLens(range, {
          title: "Reject",
          command: "continue.rejectSuggestion",
          arguments: [suggestion],
        })
      );
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

class PytestCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    let codeLenses: vscode.CodeLens[] = [];
    let lineno = 1;
    let languageLibrary = getLanguageLibrary(document.fileName);
    for (let line of document.getText().split("\n")) {
      if (
        languageLibrary.lineIsFunctionDef(line) &&
        languageLibrary.parseFunctionDefForName(line).startsWith("test_")
      ) {
        let functionToTest = languageLibrary.parseFunctionDefForName(line);
        let fileAndFunctionNameSpecifier =
          document.fileName + "::" + functionToTest;
        codeLenses.push(
          new vscode.CodeLens(new vscode.Range(lineno, 0, lineno, 1), {
            title: "Debug This Test",
            command: "continue.debugTest",
            arguments: [fileAndFunctionNameSpecifier],
          })
        );
      }
      lineno++;
    }

    return codeLenses;
  }
}

const allCodeLensProviders: { [langauge: string]: vscode.CodeLensProvider[] } =
  {
    python: [new SuggestionsCodeLensProvider(), new PytestCodeLensProvider()],
  };

export function registerAllCodeLensProviders(context: vscode.ExtensionContext) {
  for (let language in allCodeLensProviders) {
    for (let codeLensProvider of allCodeLensProviders[language]) {
      context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(language, codeLensProvider)
      );
    }
  }
}
