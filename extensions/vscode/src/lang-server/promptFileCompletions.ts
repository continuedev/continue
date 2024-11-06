import { IDE } from "core";
import { getBasename, getLastNPathParts } from "core/util";
import vscode from "vscode";
import { FileSearch } from "../util/FileSearch";

export function registerPromptFilesCompletionProvider(
  context: vscode.ExtensionContext,
  fileSearch: FileSearch,
  ide: IDE,
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
        const linePrefix =
          document
            .lineAt(position)
            .text.substr(0, position.character)
            .split(" ")
            .pop() || "";

        // Check if the last character typed is '@'
        if (!linePrefix.includes("@")) {
          return undefined;
        }

        const searchText = linePrefix.split("@").pop() || "";
        const files = fileSearch.search(searchText).map(({ filename }) => {
          return filename;
        });

        if (files.length === 0) {
          const openFiles = await ide.getOpenFiles();
          files.push(...openFiles);
        }

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
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(
              vscode.Uri.file(file),
            );
            const relativePath = workspaceFolder
              ? vscode.workspace.asRelativePath(file)
              : file;

            return {
              label: getBasename(file),
              detail: getLastNPathParts(file, 2),
              insertText: relativePath,
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
