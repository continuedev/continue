import { distance } from "fastest-levenshtein";
import Parser from "web-tree-sitter";
import { DiffLine } from "../..";
import { myersDiff } from "../../diff/myers";
import { getParserForFile } from "../../util/treeSitter";
import { findInAst } from "./findInAst";

type LazyBlockReplacements = Array<{
  lazyBlockNode: Parser.SyntaxNode;
  replacementNodes: Parser.SyntaxNode[];
}>;

// TODO: If we don't have high confidence, return undefined to fall back to slower methods
export async function deterministicApplyLazyEdit(
  oldFile: string,
  newLazyFile: string,
  filename: string,
): Promise<DiffLine[] | undefined> {
  const parser = await getParserForFile(filename);
  if (!parser) {
    return undefined;
  }

  const oldTree = parser.parse(oldFile);
  const newTree = parser.parse(newLazyFile);

  const acc: LazyBlockReplacements = [];
  diffNodes(oldTree.rootNode, newTree.rootNode, acc);

  // Sort acc by reverse line number
  acc
    .sort((a, b) => a.lazyBlockNode.startIndex - b.lazyBlockNode.startIndex)
    .reverse();

  // Reconstruct entire file by replacing lazy blocks with the replacement nodes
  const oldFileLines = oldFile.split("\n");
  const newFileChars = newLazyFile.split("");
  for (const { lazyBlockNode, replacementNodes } of acc) {
    if (replacementNodes.length === 0) {
      // TODO: Whitespace
      continue;
    }

    // Get the full string from the replacement nodes
    const startPosition = replacementNodes[0].startPosition;
    const endPosition =
      replacementNodes[replacementNodes.length - 1].endPosition;
    const replacementLines = oldFileLines.slice(
      startPosition.row,
      endPosition.row + 1,
    );
    replacementLines[0] = replacementLines[0].slice(startPosition.column);
    replacementLines[replacementLines.length - 1] = replacementLines[
      replacementLines.length - 1
    ].slice(0, endPosition.column);

    newFileChars.splice(
      lazyBlockNode.startIndex,
      lazyBlockNode.text.length,
      replacementLines.join("\n"),
    );
  }

  return myersDiff(oldFile, newFileChars.join(""));
}

const COMMENT_TYPES = ["comment"];
const LAZY_COMMENT_REGEX = /\.{3}\s*(.+?)\s*\.{3}/;
export function isLazyLine(text: string): boolean {
  return LAZY_COMMENT_REGEX.test(text);
}

function isLazyBlock(node: Parser.SyntaxNode): boolean {
  return COMMENT_TYPES.includes(node.type) && isLazyLine(node.text);
}

/**
 * Determine whether two nodes are similar
 * @param a
 * @param b
 * @returns
 */
function nodesAreSimilar(a: Parser.SyntaxNode, b: Parser.SyntaxNode): boolean {
  if (a.type !== b.type) {
    return false;
  }

  if (
    a.children[0]?.text === b.children[0]?.text &&
    a.children[1]?.text === b.children[1]?.text
  ) {
    return true;
  }

  const lineOneA = a.text.split("\n")[0];
  const lineOneB = b.text.split("\n")[0];

  const levDist = distance(lineOneA, lineOneB);
  return levDist / Math.min(lineOneA.length, lineOneB.length) <= 0.25;
}

function nodesAreExact(a: Parser.SyntaxNode, b: Parser.SyntaxNode): boolean {
  return a.text === b.text;
}

function diffLinesForNode(
  node: Parser.SyntaxNode,
  type: DiffLine["type"],
): DiffLine[] {
  return node.text.split("\n").map((line) => ({
    line,
    type,
  }));
}

/**
 * Should be like Myers diff, but lazy blocks consume all nodes until the next match
 * @param newNode
 * @param oldNode
 * @returns
 */
function diffNodes(
  oldNode: Parser.SyntaxNode,
  newNode: Parser.SyntaxNode,
  acc: LazyBlockReplacements,
): void {
  // Base case
  if (nodesAreExact(oldNode, newNode)) {
    return;
  }

  // Other base case: no lazy blocks => use line-by-line diff
  if (!findInAst(newNode, isLazyBlock)) {
    return;
  }

  const leftChildren = oldNode.namedChildren;
  const rightChildren = newNode.namedChildren;
  let isLazy = false;
  let currentLazyBlockNode: Parser.SyntaxNode | undefined = undefined;
  const currentLazyBlockReplacementNodes = [];

  while (leftChildren.length > 0 && rightChildren.length > 0) {
    const L = leftChildren[0];
    const R = rightChildren[0];

    // Consume lazy block
    if (isLazyBlock(R)) {
      // Enter "lazy mode"
      isLazy = true;
      currentLazyBlockNode = R;
      R.startIndex;
      rightChildren.shift();
      continue;
    }

    if (isLazy) {
      if (nodesAreSimilar(L, R)) {
        // L ~= R

        // recurse
        diffNodes(L, R, acc);

        // then consume lazy, L, and R
        leftChildren.shift();
        rightChildren.shift();

        // Record the replacement lines
        acc.push({
          lazyBlockNode: currentLazyBlockNode!,
          replacementNodes: currentLazyBlockReplacementNodes,
        });

        // Exit "lazy mode"
        isLazy = false;
        currentLazyBlockReplacementNodes.length = 0;
        currentLazyBlockNode = undefined;
      } else {
        // Push "same" lines
        currentLazyBlockReplacementNodes.push(L);

        // L != R, consume L
        leftChildren.shift();
      }
    } else {
      // When not lazy, we look for the first match of L
      const index = rightChildren.findIndex((node) => nodesAreSimilar(L, node));

      if (index === -1) {
        leftChildren.shift();
      } else {
        // Match found, insert all right nodes before the match
        for (let i = 0; i < index; i++) {
          rightChildren.shift();
        }

        // then recurse at the match
        diffNodes(L, rightChildren[0], acc);

        // then consume L and R
        leftChildren.shift();
        rightChildren.shift();
      }
    }
  }

  if (isLazy) {
    acc.push({
      lazyBlockNode: currentLazyBlockNode!,
      replacementNodes: currentLazyBlockReplacementNodes,
    });
  }
}
