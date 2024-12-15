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
): Promise<string | undefined> {
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
  } else if (ctx.options.logOutlineCreation) {
    ctx.writeLog(`createOutline: unable to parse ${filepath}`);
  }
}
