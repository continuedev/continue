import { getBasename, getLastNPathParts } from "core/util";
import vscode from "vscode";

export function registerPromptFilesCompletionProvider(
  context: vscode.ExtensionContext,
) {
  let provider = vscode.languages.registerCompletionItemProvider(
    "promptLanguage",
    {
      async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
      ) {
        const linePrefix = document
          .lineAt(position)
          .text.substr(0, position.character);

        // Check if the last character typed is '@'
        if (!linePrefix.endsWith("@")) {
          return undefined;
        }

        const files = await vscode.workspace.findFiles("**/*");

        // Provide completion items
        return [
          {
            label: "terminal",
            detail: "Contents of terminal",
            sortText: "...",
          },
          {
            label: "tree",
            detail: "File tree of workspace",
            sortText: "...",
          },
          {
            label: "open",
            detail: "All open files",
            sortText: "...",
          },
          {
            label: "os",
            detail: "Operating system information",
            sortText: "...",
          },
          {
            label: "problems",
            detail: "Problems in the current file",
            sortText: "...",
          },
          {
            label: "currentFile",
            detail: "Current file",
            sortText: "...",
          },
          {
            label: "repo-map",
            detail: "Map of files in your repo",
            sortText: "...",
          },
          ...files.map((file) => {
            return {
              label: getBasename(file.path),
              detail: getLastNPathParts(file.path, 2),
              insertText: file.path,
              kind: vscode.CompletionItemKind.File,
            };
          }),
        ];
      },
    },
    "@", // Trigger completion when '@' is typed
  );

  context.subscriptions.push(provider);
}
