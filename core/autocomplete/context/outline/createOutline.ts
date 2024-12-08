import Parser from "web-tree-sitter";
import { Range } from "../../..";
import {
  getLanguageForFile,
  rangeToString,
  treeToString,
} from "../../../util/treeSitter";
import { getAst, getNodeAroundRange } from "../../util/ast";
import { AutocompleteLoggingContext } from "../../util/AutocompleteContext";

function collectOutline(
  node: Parser.SyntaxNode,
  drop: (startIndex: number, endIndex: number, replacement: string) => void,
  ctx: AutocompleteLoggingContext,
) {
  const replacement = ctx.langOptions.outlineNodeReplacements[node.type];
  if (ctx.options.logOutlineCreation) {
    ctx.writeLog(
      `collectOutline: ${node.type} ${rangeToString(node)} ${replacement}`,
    );
  }
  if (replacement !== undefined) {
    drop(node.startIndex, node.endIndex, replacement);
    return;
  }
  let children = node.children;
  for (let i = 0; i < children.length; i++) {
    collectOutline(children[i], drop, ctx);
  }
}

export async function createOutline(
  filepath: string,
  fileContents: string,
  range: Range,
  ctx: AutocompleteLoggingContext,
) {
  const ast = await getAst(filepath, fileContents);
  const language = await getLanguageForFile(filepath);
  if (ast !== undefined && language !== undefined) {
    let node = getNodeAroundRange(ast, range);
    if (ctx.options.logOutlineCreation) {
      ctx.writeLog(
        `createOutline: ${filepath} ${rangeToString(node)} ${treeToString(node)}`,
      );
    }
    let snippet = "";
    let index = node.startIndex;
    collectOutline(
      node,
      (startIndex, endIndex, replacement) => {
        if (startIndex > index) {
          snippet += fileContents.substring(index, startIndex);
        }
        snippet += replacement;
        index = endIndex;
      },
      ctx,
    );
    snippet += fileContents.substring(index, node.endIndex);
    return snippet;
  }
}

/**
 * Dead code, to be removed
 */
export async function createOutline1(
  filepath: string,
  fileContents: string,
  range: Range,
) {
  const ast = await getAst(filepath, fileContents);
  const language = await getLanguageForFile(filepath);
  if (ast !== undefined && language !== undefined) {
    let node = getNodeAroundRange(ast, range);
    console.log(range, treeToString(node));

    const query = language.query(`
; Pattern for return type with direct type_identifier
(
  (class_declaration
    (class_body) @end
  ) @startGroup
)
(method_definition (statement_block) @end) @start
(public_field_definition) @include
(function_declaration (statement_block) @end) @start
(lexical_declaration)
        `);

    let snippet = "";
    const groupEnds: number[] = [];
    let indent = "";

    function addSnippet(startIndex: number, endIndex: number) {
      // close the last opened group if it ends before the current start
      if (
        groupEnds.length > 0 &&
        groupEnds[groupEnds.length - 1] < startIndex
      ) {
        indent = indent.substring(2);
        snippet += indent + "}\n\n";
        groupEnds.pop();
      }

      snippet += fileContents
        .substring(startIndex, endIndex)
        .trim()
        .split("\n")
        .map((line) => indent + line)
        .join("\n");
    }

    query.matches(node).forEach((match) => {
      const captures = captureMap(match);

      const include = captures.get("include");
      if (include) {
        addSnippet(include.startIndex, include.endIndex);
        snippet += ";\n";
      } else {
        const isGroup = captures.has("startGroup");
        const start = captures.get(isGroup ? "startGroup" : "start")!;
        const end = captures.get("end")!;
        addSnippet(start.startIndex, end.startIndex);
        if (isGroup) {
          snippet += " { \n";
          indent += "  ";
          groupEnds.push(start.endIndex);
        } else {
          snippet += ";\n";
        }
      }
    });

    // Close any remaining groups
    while (groupEnds.length > 0) {
      indent = indent.substring(2);
      snippet += "}\n";
      groupEnds.pop();
    }

    console.log("snippet: " + snippet);
    return snippet;
  }
}

function captureMap(match: Parser.QueryMatch) {
  const result = new Map<string, Parser.SyntaxNode>();
  match.captures.forEach((capture) => {
    result.set(capture.name, capture.node);
  });
  return result;
}
