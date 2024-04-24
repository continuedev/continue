import * as vscode from "vscode";

/**
 * To declare a new hover provider:
 *
 * 1. Define a new class that implements the `vscode.HoverProvider` interface.
 *    This class must implement a `provideHover` method with the following signature:
 *
 *        provideHover(
 *          document: vscode.TextDocument,
 *          position: vscode.Position,
 *          token: vscode.CancellationToken
 *        ): vscode.ProviderResult<vscode.Hover>
 *
 *    This method should return a `vscode.Hover` object (or a Promise that resolves to one)
 *    when the hover feature should be activated, or `undefined` otherwise.
 *
 * 2. Add an instance of your new class to the `hoverProviders` array. For example:
 *
 *        const hoverProviders = [new TodoHoverProvider(), new YourNewHoverProvider()];
 *
 *    This array is used in the `registerAllHoverProviders` function to register all hover providers.
 *
 * 3. The `registerAllHoverProviders` function should be called during the activation of your extension,
 *    passing the `vscode.ExtensionContext` object provided by VS Code.
 */

class TodoHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const regex = /\/\/\s*TODO:(.*)/;
    const lineOfText = document.lineAt(position.line);
    const match = lineOfText.text.match(regex);

    if (match) {
      const lineNumber = position.line + 1;
      let todoText = match[1];

      todoText = todoText.trim();

      const argsQI = encodeURIComponent(JSON.stringify([lineNumber, todoText]));
      const argsSC = encodeURIComponent(JSON.stringify([todoText]));

      const markdownContent = new vscode.MarkdownString(
        `continue: [Generate Code](command:continue.quickInsert?${argsQI}) | [Start Conversation](command:continue.sendMainUserInput?${argsSC})`
      );
      markdownContent.isTrusted = true;

      return new vscode.Hover(markdownContent);
    }

    return undefined;
  }
}

const hoverProviders = [new TodoHoverProvider()];

export function registerAllHoverProviders(context: vscode.ExtensionContext) {
  hoverProviders.forEach((provider) => {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider("*", provider)
    );
  });
}
