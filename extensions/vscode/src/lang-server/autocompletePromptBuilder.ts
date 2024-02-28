import { IDE } from "core";
import { AutocompleteSnippet } from "core/autocomplete/ranking";
import * as vscode from "vscode";

export class AutocompletePromptBuilder {
  constructor(private readonly ide: IDE) {}

  async getDefinition(
    uri: string,
    line: number,
    character: number
  ): Promise<AutocompleteSnippet | undefined> {
    const definitions = (await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      vscode.Uri.parse(uri),
      new vscode.Position(line, character)
    )) as any;

    if (definitions[0]?.targetRange) {
      return {
        filepath: uri,
        contents: await this.ide.readRangeInFile(
          definitions[0].targetUri.fsPath,
          definitions[0].targetRange
        ),
        range: definitions[0].targetRange,
        score: 0.8
      };
    }

    return undefined;
  }
}
