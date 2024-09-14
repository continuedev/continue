import { distance } from "fastest-levenshtein";
import Parser from "web-tree-sitter";
import { DiffLine } from "../..";
import { myersDiff } from "../../diff/myers";
import { getParserForFile } from "../../util/treeSitter";
import { findInAst } from "./findInAst";

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

  const diffLines = diffNodes(oldTree.rootNode, newTree.rootNode);

  return diffLines;
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
): DiffLine[] {
  // Base case
  if (nodesAreExact(oldNode, newNode)) {
    return diffLinesForNode(newNode, "same");
  }

  // Other base case: no lazy blocks => use line-by-line diff
  const firstLazyNodeInSubtree = findInAst(newNode, isLazyBlock);
  if (!firstLazyNodeInSubtree) {
    const myersDiffLines = myersDiff(oldNode.text, newNode.text);
    return myersDiffLines;
  }

  const diffLines: DiffLine[] = [];
  const leftChildren = oldNode.children;
  const rightChildren = newNode.children;
  let isLazy = false;

  // Deal with any leading whitespace in this node
  const leadingNewlines =
    leftChildren[0].startPosition.row - oldNode.endPosition.row;
  for (let i = 1; i < leadingNewlines - 1; ++i) {
    diffLines.push({ type: "same", line: "" });
  }

  function consumeLeftChild(L: Parser.SyntaxNode) {
    leftChildren.shift();
    const nextNode = leftChildren[0];

    if (!nextNode) {
      return;
    }

    const blankLinesBetween = nextNode.startPosition.row - L.endPosition.row;
    for (let i = 0; i < blankLinesBetween - 1; i++) {
      diffLines.push({
        type: "same",
        line: "",
      });
    }
  }

  while (leftChildren.length > 0 && rightChildren.length > 0) {
    const L = leftChildren[0];
    const R = rightChildren[0];

    // Consume lazy block
    if (isLazyBlock(R)) {
      isLazy = true;
      rightChildren.shift();
      continue;
    }

    if (isLazy) {
      if (nodesAreSimilar(L, R)) {
        // L ~= R

        // recurse
        const subDiffs = diffNodes(L, R);
        diffLines.push(...subDiffs);

        // then consume lazy, L, and R
        isLazy = false;
        consumeLeftChild(L);
        rightChildren.shift();
      } else {
        // Push "same" lines
        diffLines.push(...diffLinesForNode(L, "same"));

        // L != R, consume L
        consumeLeftChild(L);
      }
    } else {
      // When not lazy, we look for the first match of L
      const index = rightChildren.findIndex((node) => nodesAreSimilar(L, node));

      if (index === -1) {
        diffLines.push(
          // TODO: What are we returning? Iterate over the lines?
          ...diffLinesForNode(L, "old"),
        );
        consumeLeftChild(L);
      } else {
        // Match found, insert all right nodes before the match
        for (let i = 0; i < index; i++) {
          diffLines.push(...diffLinesForNode(rightChildren[0], "new"));
          rightChildren.shift();
        }

        // then recurse at the match
        const subDiffs = diffNodes(L, rightChildren[0]);
        diffLines.push(...subDiffs);

        // then consume L and R
        consumeLeftChild(L);
        rightChildren.shift();
      }
    }
  }

  return diffLines;
}
