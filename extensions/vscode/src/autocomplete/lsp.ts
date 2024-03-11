import { IDE, RangeInFile } from "core";
import { getAst, getTreePathAtCursor } from "core/autocomplete/ast";
import { AutocompleteSnippet } from "core/autocomplete/ranking";
import { RangeInFileWithContents } from "core/commands/util";
import * as vscode from "vscode";
import Parser from "web-tree-sitter";

type GotoProviderName =
  | "vscode.executeDefinitionProvider"
  | "vscode.executeTypeDefinitionProvider"
  | "vscode.executeDeclarationProvider"
  | "vscode.executeImplementationProvider"
  | "vscode.executeReferenceProvider";
async function executeGotoProvider(
  uri: string,
  line: number,
  character: number,
  name: GotoProviderName,
): Promise<RangeInFile[]> {
  const definitions = (await vscode.commands.executeCommand(
    name,
    vscode.Uri.parse(uri),
    new vscode.Position(line, character),
  )) as any;

  return definitions
    .filter((d: any) => d.targetUri && d.targetRange)
    .map((d: any) => ({
      filepath: d.targetUri.fsPath,
      range: d.targetRange,
    }));
}

async function getDefinitionsForNode(
  uri: string,
  node: Parser.SyntaxNode,
): Promise<RangeInFile[]> {
  const ranges: RangeInFile[] = [];
  switch (node.type) {
    case "call_expression":
      // function call -> function definition
      const defs = await executeGotoProvider(
        uri,
        node.startPosition.row,
        node.startPosition.column,
        "vscode.executeDefinitionProvider",
      );
      ranges.push(...defs);
      break;
    case "variable_declarator":
      // variable assignment -> variable definition/type
      // usages of the var that appear after the declaration
      break;
    case "impl_item":
      // impl of trait -> trait definition
      break;
    case "":
      // function definition -> implementations?
      break;
  }
  return ranges;
}

/**
 * and other stuff not directly on the path:
 * - variables defined on line above
 * ...etc...
 */

export async function getDefinitionsFromLsp(
  filepath: string,
  contents: string,
  cursorIndex: number,
  ide: IDE,
): Promise<AutocompleteSnippet[]> {
  const ast = await getAst(filepath, contents);
  if (!ast) return [];

  const treePath = await getTreePathAtCursor(ast, cursorIndex);
  if (!treePath) return [];

  const results: RangeInFileWithContents[] = [];
  for (const node of treePath.reverse()) {
    const definitions = await getDefinitionsForNode(filepath, node);
    results.push(
      ...(await Promise.all(
        definitions.map(async (def) => ({
          ...def,
          contents: await ide.readRangeInFile(
            def.filepath,
            new vscode.Range(
              new vscode.Position(
                def.range.start.line,
                def.range.start.character,
              ),
              new vscode.Position(def.range.end.line, def.range.end.character),
            ),
          ),
        })),
      )),
    );
  }

  return results.map((result) => ({
    ...result,
    score: 0.8,
  }));
}
