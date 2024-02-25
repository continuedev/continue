import Parser from "web-tree-sitter";
import { FileWithContents } from "..";
import { RangeInFileWithContents } from "../commands/util";
import { getAst, getTreePathAtCursor } from "./ast";

async function getDefinitionForNode(
  node: Parser.SyntaxNode
): Promise<RangeInFileWithContents[]> {
  switch (node.type) {
    case "call_expression":
      // function call -> function definition
      break;
    case "":
      // variable assignment -> variable definition/type
      break;
    case "":
      // impl of trait -> trait definition
      break;
    case "":
      //
      break;
  }
  return [];
}

/**
 * and other stuff not directly on the path:
 * - variables defined on line above
 * ...etc...
 */

async function getDefinitionsFromLsp(
  document: FileWithContents,
  cursorIndex: number
): Promise<RangeInFileWithContents[]> {
  const ast = await getAst(document.filepath, document.contents);
  if (!ast) return [];

  const treePath = await getTreePathAtCursor(ast, cursorIndex);
  if (!treePath) return [];

  const results: RangeInFileWithContents[] = [];
  for (const node of treePath.reverse()) {
    const definitions = await getDefinitionForNode(node);
    results.push(...definitions);
  }

  return results;
}
