import { IDE, RangeInFile } from "core";
import { getAst, getTreePathAtCursor } from "core/autocomplete/ast";
import { GetLspDefinitionsFunction } from "core/autocomplete/completionProvider";
import { AutocompleteLanguageInfo } from "core/autocomplete/languages";
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
    .filter((d: any) => (d.targetUri || d.uri) && (d.targetRange || d.range))
    .map((d: any) => ({
      filepath: (d.targetUri || d.uri).fsPath,
      range: d.targetRange || d.range,
    }));
}

function isRifWithContents(
  rif: RangeInFile | RangeInFileWithContents,
): rif is RangeInFileWithContents {
  return typeof (rif as any).contents === "string";
}

export async function getDefinitionsForNode(
  uri: string,
  node: Parser.SyntaxNode,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
): Promise<RangeInFileWithContents[]> {
  const ranges: (RangeInFile | RangeInFileWithContents)[] = [];
  switch (node.type) {
    case "call_expression":
      // function call -> function definition
      const funDefs = await executeGotoProvider(
        uri,
        node.startPosition.row,
        node.startPosition.column,
        "vscode.executeDefinitionProvider",
      );
      ranges.push(...funDefs);
      break;
    case "variable_declarator":
      // variable assignment -> variable definition/type
      // usages of the var that appear after the declaration
      break;
    case "impl_item":
      // impl of trait -> trait definition
      break;
    case "new_expression":
      const [classDef] = await executeGotoProvider(
        uri,
        node.endPosition.row,
        node.endPosition.column,
        "vscode.executeDefinitionProvider",
      );
      ranges.push({
        ...classDef,
        contents: `${lang.comment} ${node.text}:\n${(
          await ide.readRangeInFile(classDef.filepath, classDef.range)
        ).trim()}`,
      });
      break;
    case "":
      // function definition -> implementations?
      break;
  }
  return await Promise.all(
    ranges.map(async (rif) => {
      if (!isRifWithContents(rif)) {
        return {
          ...rif,
          contents: await ide.readRangeInFile(rif.filepath, rif.range),
        };
      }
      return rif;
    }),
  );
}

/**
 * and other stuff not directly on the path:
 * - variables defined on line above
 * ...etc...
 */

export const getDefinitionsFromLsp: GetLspDefinitionsFunction = async (
  filepath: string,
  contents: string,
  cursorIndex: number,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
): Promise<AutocompleteSnippet[]> => {
  try {
    const ast = await getAst(filepath, contents);
    if (!ast) return [];

    const treePath = await getTreePathAtCursor(ast, cursorIndex);
    if (!treePath) return [];

    const results: RangeInFileWithContents[] = [];
    for (const node of treePath.reverse()) {
      const definitions = await getDefinitionsForNode(
        filepath,
        node,
        ide,
        lang,
      );
      results.push(...definitions);
    }

    return results.map((result) => ({
      ...result,
      score: 0.8,
    }));
  } catch (e) {
    console.warn("Error getting definitions from LSP: ", e);
    return [];
  }
};
