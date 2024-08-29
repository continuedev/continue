import { getContinueRcPath, getTsConfigPath, migrate } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import path from "node:path";
import * as vscode from "vscode";
import { VsCodeExtension } from "../extension/VsCodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion } from "../util/util";
import { getExtensionUri } from "../util/vscode";
import { VsCodeContinueApi } from "./api";
import { setupInlineTips } from "./inlineTips";

import { getUpdatedRanges } from "vscode-position-tracking";

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();
  getContinueRcPath();

  // Register commands and providers
  registerQuickFixProvider();
  setupInlineTips(context);

  const vscodeExtension = new VsCodeExtension(context);

  migrate("showWelcome_1", () => {
    vscode.commands.executeCommand(
      "markdown.showPreview",
      vscode.Uri.file(
        path.join(getExtensionUri().fsPath, "media", "welcome.md"),
      ),
    );

    vscode.commands.executeCommand("continue.focusContinueInput");
  });

  // Load Continue configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    context.globalState.update("hasBeenInstalled", true);
    Telemetry.capture(
      "install",
      {
        extensionVersion: getExtensionVersion(),
      },
      true,
    );
  }

  const api = new VsCodeContinueApi(vscodeExtension);
  const continuePublicApi = {
    registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
  };

  setupTest();

  // 'export' public api-surface
  // or entire extension for testing
  return process.env.NODE_ENV === "test"
    ? {
        ...continuePublicApi,
        extension: vscodeExtension,
      }
    : continuePublicApi;
}

class ContextCompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<
    vscode.CompletionList<vscode.CompletionItem> | vscode.CompletionItem[]
  > {
    const charBeforeCursor = document.getText(
      new vscode.Range(
        position.with(undefined, position.character - 1),
        position,
      ),
    );
    if (charBeforeCursor === "@") {
      return [
        {
          label: "customContext",
          kind: vscode.CompletionItemKind.User,
          detail: "customContext",
          insertText: "customContext",
          range: new vscode.Range(position, position),
          sortText: "00000000000000000",
        },
      ];
    }
    return [];
  }
  resolveCompletionItem?(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CompletionItem> {
    console.log("RESOLVED");
    return item;
  }
}

function setupTest() {
  const textDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "#ff0000",
  });
  let ranges: vscode.Range[] = [];
  let currentEditor: vscode.TextEditor | undefined;
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    ranges = [
      new vscode.Range(new vscode.Position(2, 0), new vscode.Position(3, 0)),
    ];
    editor?.setDecorations(textDecorationType, ranges);
    currentEditor = editor;
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    // To update your document locations according to each
    // document change that occurs,
    // the getUpdatedRanges() function has to be used
    // within an onDidChangeTextDocument event listener.
    vscode.workspace.onDidChangeTextDocument((event) => {
      ranges = getUpdatedRanges(
        // The locations you want to update,
        // under the form of an array of ranges.
        // It is a required argument.
        ranges,
        // Array of document changes.
        // It is a required argument.
        [...event.contentChanges],
        // An object with various options.
        // It is not a required argument,
        // nor any of its options.
        {
          onDeletion: "shrink",
          onAddition: "extend",
        },
      );
      currentEditor?.setDecorations(textDecorationType, ranges);
      // The function returns the updated locations
      // according to document changes,
      // under the form of a new array of ranges.
    });
  });

  vscode.languages.registerCompletionItemProvider(
    "javascript",
    new ContextCompletionItemProvider(),
    "@",
  );
}
