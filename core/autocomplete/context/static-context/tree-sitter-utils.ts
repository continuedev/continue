import * as fs from "fs/promises";
import Parser from "web-tree-sitter";
import { getAst } from "../../util/ast";
import { getFullLanguageName, getQueryForFile } from "../../../util/treeSitter";
import path from "path";

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
  ast: Parser.Tree
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

export async function extractTopLevelDecls(currentFile: string, givenParser?: Parser) {
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
    path.join(
      __dirname,
      "queries",
      "relevant-headers-queries",
      `${language}-get-toplevel-headers.scm`
    )
  );
  if (!query) {
    throw new Error(
      `failed to get query for file ${currentFile} and language ${language}`
    );
  }
  return query.matches(ast.rootNode);
}

export async function extractTopLevelDeclsWithFormatting(currentFile: string, givenParser?: Parser) {
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
    path.join(
      __dirname,
      "queries",
      "relevant-headers-queries",
      `${language}-get-toplevel-headers.scm`
    )
  );
  if (!query) {
    throw new Error(
      `failed to get query for file ${currentFile} and language ${language}`
    );
  }
  const matches = query.matches(ast.rootNode);

  const results = [];

  for (const match of matches) {
    const item: {
      declaration: string;
      nodeType: string;
      name: string;
      declaredType: string;
      returnType?: string;
    } = {
      declaration: "",
      nodeType: "",
      name: "",
      declaredType: "",
    };

    for (const { name, node } of match.captures) {
      if (name === "top.var.decl") {
        item.nodeType = "variable";
        item.declaration = node.text;

        // Attempt to get the declared type (e.g., const x: string = ...)
        const typeNode = node.descendantsOfType("type_annotation")[0];
        if (typeNode) {
          item.declaredType = typeNode.text.replace(/^:\s*/, "");
        }
      } else if (name === "top.var.name" || name === "top.fn.name") {
        item.name = node.text;
      } else if (name === "top.fn.decl") {
        item.nodeType = "function";
        item.declaration = node.text;

        // Get the return type (e.g., function foo(): string)
        const returnTypeNode = node.childForFieldName("return_type");
        if (returnTypeNode) {
          item.returnType = returnTypeNode.text.replace(/^:\s*/, "");
        }

        // Get declaredType if needed (TypeScript style)
        const nameNode = node.childForFieldName("name");
        if (nameNode && nameNode.nextSibling?.type === "type_annotation") {
          item.declaredType = nameNode.nextSibling.text.replace(/^:\s*/, "");
        }
      }
    }

    if (item.name && item.declaration) {
      results.push(item);
    }
  }

  return results;
}
