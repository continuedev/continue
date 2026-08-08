import { IDE } from "core";
import { getUriPathBasename, getLastNPathParts } from "core/util/uri";
import vscode from "vscode";

import { FileSearch } from "../util/FileSearch";

class PromptFilesCompletionItemProvider
  implements vscode.CompletionItemProvider
{
  constructor(
    private fileSearch: FileSearch,
    private ide: IDE,
  ) {}
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
    const files = this.fileSearch.search(searchText);

    if (files.length === 0) {
      const openFiles = await this.ide.getOpenFiles();
      files.push(
        ...openFiles.map((fileUri) => ({
          id: fileUri,
          relativePath: vscode.workspace.asRelativePath(fileUri),
        })),
      );
    }

    // Provide completion items
    return [
      {
        label: "terminal",
        detail: "Contents of terminal",
        sortText: "...",
        kind: vscode.CompletionItemKind.Field,
      },
      {
        label: "tree",
        detail: "File tree of workspace",
        sortText: "...",
        kind: vscode.CompletionItemKind.Field,
      },
      {
        label: "open",
        detail: "All open files",
        sortText: "...",
        kind: vscode.CompletionItemKind.Field,
      },
      {
        label: "os",
        detail: "Operating system information",
        sortText: "...",
        kind: vscode.CompletionItemKind.Field,
      },
      {
        label: "problems",
        detail: "Problems in the current file",
        sortText: "...",
        kind: vscode.CompletionItemKind.Field,
      },
      {
        label: "currentFile",
        detail: "Current file",
        sortText: "...",
        kind: vscode.CompletionItemKind.Field,
      },
      {
        label: "repo-map",
        detail: "Map of files in your repo",
        sortText: "...",
        kind: vscode.CompletionItemKind.Field,
      },
      ...files.map((file) => {
        return {
          label: getUriPathBasename(file.id),
          detail: getLastNPathParts(file.relativePath, 2),
          insertText: file.relativePath,
          kind: vscode.CompletionItemKind.File,
        };
      }),
    ];
  }
}

function registerPromptFilesCompletionProvider(
  context: vscode.ExtensionContext,
  fileSearch: FileSearch,
  ide: IDE,
) {
  let provider = vscode.languages.registerCompletionItemProvider(
    "promptLanguage",
    new PromptFilesCompletionItemProvider(fileSearch, ide),
    "@", // Trigger completion when '@' is typed
  );

  context.subscriptions.push(provider);
}

class YamlKeysCompletionItemProvider implements vscode.CompletionItemProvider {
  private yamlKeys: { key: string; description: string }[] = [
    {
      key: "name",
      description: "The name of the prompt template",
    },
    {
      key: "description",
      description: "A description of what this prompt template does",
    },
    {
      key: "version",
      description: ".prompt file version. Either 1 (legacy) or 2",
    },
  ];

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ) {
    const lineText = document.lineAt(position).text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // 0. If no delimiter in the file, return no completions
    const fullContent = document.getText();
    if (!fullContent.includes("---")) {
      return undefined;
    }

    // 1. Check if the cursor is in YAML section (before --- delimiter)
    const beforeDelimiter = isCursorBeforeDelimiter(document, position);

    if (!beforeDelimiter) {
      return undefined;
    }

    // 2. Check if there is no colon before the cursor on this line
    if (textBeforeCursor.includes(":")) {
      return undefined;
    }

    // 3. Provide completion items for YAML keys
    const completionItems = this.yamlKeys.map((key) => {
      const item = new vscode.CompletionItem(
        key.key,
        vscode.CompletionItemKind.Property,
      );
      item.documentation = new vscode.MarkdownString(key.description);
      item.insertText = key.key + ": ";
      return item;
    });

    return completionItems;
  }
}

// Helper function to determine if the cursor is before the '---' delimiter
function isCursorBeforeDelimiter(
  document: vscode.TextDocument,
  position: vscode.Position,
): boolean {
  const delimiter = "---";
  for (let i = 0; i < document.lineCount; i++) {
    const lineText = document.lineAt(i).text.trim();
    if (lineText === delimiter) {
      // Cursor is before the delimiter
      return position.line < i;
    }
  }
  // Delimiter not found; assume entire document is YAML
  return true;
}

function registerYamlKeysCompletionProvider(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerCompletionItemProvider(
    "promptLanguage",
    new YamlKeysCompletionItemProvider(),
    ...Array.from("abcdefghijklmnopqrstuvwxyz"), // Trigger on all lowercase letters
  );

  context.subscriptions.push(provider);
}

// Helper function to determine if the position is within the YAML header
function isPositionInYamlHeader(
  document: vscode.TextDocument,
  position: vscode.Position,
): boolean {
  const delimiter = "---";
  for (let i = 0; i < document.lineCount; i++) {
    const lineText = document.lineAt(i).text.trim();
    if (lineText === delimiter) {
      // Cursor is before the delimiter
      return position.line < i;
    }
  }
  // Delimiter not found; assume entire document is YAML
  return true;
}

export function registerAllPromptFilesCompletionProviders(
  context: vscode.ExtensionContext,
  fileSearch: FileSearch,
  ide: IDE,
) {
  registerPromptFilesCompletionProvider(context, fileSearch, ide);
  registerYamlKeysCompletionProvider(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || event.document !== editor.document) {
        return;
      }

      const languageId = editor.document.languageId;
      if (languageId !== "promptLanguage") {
        return;
      }

      for (const change of event.contentChanges) {
        // Get position after the change by applying the change length
        const isDeletion = change.text.length <= 0;
        const lines = change.text.split("\n");
        const positionAfterChange = isDeletion
          ? change.range.start
          : new vscode.Position(
              change.range.start.line + lines.length - 1,
              lines.length === 1
                ? change.range.start.character + change.text.length
                : lines[lines.length - 1].length,
            );

        // Use the updated document state
        const line = event.document.lineAt(positionAfterChange.line);

        // Check if we're in the YAML header using current document state
        const inYamlHeader = isPositionInYamlHeader(
          event.document,
          positionAfterChange,
        );
        // Check if we're at the first character of the line
        const atLineStart = positionAfterChange.character === 0;
        // Check if the current line is empty (excluding whitespace)
        const lineIsEmpty = line.text.trim() === "";

        if (inYamlHeader && atLineStart && lineIsEmpty) {
          // Delay slightly to ensure the editor updates before triggering suggestions
          setTimeout(() => {
            // Trigger suggestions
            vscode.commands.executeCommand("editor.action.triggerSuggest");
          }, 50);
        }
      }
    }),
  );
}
