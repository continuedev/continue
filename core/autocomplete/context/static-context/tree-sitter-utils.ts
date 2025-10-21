import * as fs from "fs/promises";
import Parser from "web-tree-sitter";
import { getFullLanguageName, getQueryForFile } from "../../../util/treeSitter";
import { getAst } from "../../util/ast";

export interface TypeDeclarationResult {
  name: string;
  fullText: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  kind: string;
}

export function findEnclosingTypeDeclaration(
  sourceCode: string,
  cursorLine: number,
  cursorColumn: number,
  ast: Parser.Tree,
): TypeDeclarationResult | null {
  const point = { row: cursorLine, column: cursorColumn };
  let node = ast.rootNode.descendantForPosition(point);

  while (
    node &&
    ![
      "type_alias_declaration",
      "interface_declaration",
      "enum_declaration",
    ].includes(node.type)
  ) {
    if (!node.parent) return null;
    node = node.parent;
  }

  if (!node) return null;

  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "<anonymous>";
  const fullText = sourceCode.slice(node.startIndex, node.endIndex);

  return {
    name,
    fullText,
    startLine: node.startPosition.row,
    startColumn: node.startPosition.column,
    endLine: node.endPosition.row,
    endColumn: node.endPosition.column,
    kind: node.type,
  };
}

export async function extractTopLevelDecls(
  currentFile: string,
  givenParser?: Parser,
) {
  const ast = await getAst(currentFile, await fs.readFile(currentFile, "utf8"));
  if (!ast) {
    throw new Error(`failed to get ast for file ${currentFile}`);
  }
  let language;
  if (givenParser) {
    language = givenParser.getLanguage();
  } else {
    language = getFullLanguageName(currentFile);
  }

  const query = await getQueryForFile(
    currentFile,
    `static-context-queries/relevant-headers-queries/${language}-get-toplevel-headers.scm`,
  );
  if (!query) {
    throw new Error(
      `failed to get query for file ${currentFile} and language ${language}`,
    );
  }
  return query.matches(ast.rootNode);
}

export function extractFunctionTypeFromDecl(match: Parser.QueryMatch): string {
  let paramsNode: Parser.SyntaxNode | undefined = undefined;
  let returnNode: Parser.SyntaxNode | undefined = undefined;

  for (const capture of match.captures) {
    if (capture.name === "top.fn.param.type") {
      paramsNode = capture.node;
    } else if (capture.name === "top.fn.type") {
      returnNode = capture.node;
    }
  }

  if (!paramsNode) {
    console.error(
      `extractFunctionTypeFromDecl: paramsNode ${paramsNode} not found`,
    );
    throw new Error(
      `extractFunctionTypeFromDecl: paramsNode ${paramsNode} not found`,
    );
  }

  if (!returnNode) {
    console.error(
      `extractFunctionTypeFromDecl: returnNode ${returnNode} not found`,
    );
    throw new Error(
      `extractFunctionTypeFromDecl: returnNode ${returnNode} not found`,
    );
  }

  return `(${paramsNode!.text}) => ${returnNode!.text}`;
}

export function unwrapToBaseType(node: Parser.SyntaxNode): Parser.SyntaxNode {
  if (
    [
      "function_type",
      "tuple_type",
      "type_identifier",
      "predefined_type",
    ].includes(node.type)
  ) {
    return node;
  }

  for (const child of node.namedChildren) {
    const unwrapped = unwrapToBaseType(child!);
    if (
      unwrapped !== child ||
      [
        "function_type",
        "tuple_type",
        "type_identifier",
        "predefined_type",
      ].includes(unwrapped.type)
    ) {
      return unwrapped;
    }
  }

  return node;
}
