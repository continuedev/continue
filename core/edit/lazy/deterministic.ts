import Parser from "web-tree-sitter";
import { DiffLine } from "../..";
import { myersDiff } from "../../diff/myers";
import { getParserForFile } from "../../util/treeSitter";

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
const LAZY_COMMENT_REGEX = /\s*...\s*.?\s...$/;
function isLazyBlock(node: Parser.SyntaxNode): boolean {
  return (
    COMMENT_TYPES.includes(node.type) && LAZY_COMMENT_REGEX.test(node.text)
  );
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

  return true; // TODO
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
  const firstLazyBlockIndex = newNode.children.find((child) =>
    isLazyBlock(child),
  );
  if (!firstLazyBlockIndex) {
    const diffLines = myersDiff(oldNode.text, newNode.text);
    return diffLines;
  }

  const diffLines: DiffLine[] = [];
  const leftChildren = oldNode.children;
  const rightChildren = newNode.children;
  let isLazy = false;

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
        leftChildren.shift();
        rightChildren.shift();
      } else {
        // L != R, consume L
        leftChildren.shift();
      }
    } else {
      // When not lazy, we look for the first match of L
      const index = rightChildren.findIndex((node) => nodesAreSimilar(L, node));

      if (index === -1) {
        leftChildren.shift();
        diffLines.push(
          // TODO: What are we returning? Iterate over the lines?
          ...diffLinesForNode(L, "old"),
        );
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
        leftChildren.shift();
        rightChildren.shift();
      }
    }
  }

  return diffLines;
}
