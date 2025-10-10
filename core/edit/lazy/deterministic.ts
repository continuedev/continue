import path from "path";

import { distance } from "fastest-levenshtein";
import Parser from "web-tree-sitter";

import { DiffLine } from "../..";
import { LANGUAGES } from "../../autocomplete/constants/AutocompleteLanguageInfo";
import { myersDiff } from "../../diff/myers";
import { getParserForFile } from "../../util/treeSitter";

import { findInAst } from "./findInAst";

type AstReplacements = Array<{
  nodeToReplace: Parser.SyntaxNode;
  replacementNodes: Parser.SyntaxNode[];
}>;

const LAZY_COMMENT_REGEX = /\.{3}\s*(.+?)\s*\.{3}/;
export function isLazyText(text: string): boolean {
  return LAZY_COMMENT_REGEX.test(text);
}

function reconstructNewFile(
  oldFile: string,
  newFile: string,
  lazyBlockReplacements: AstReplacements,
  parser: Parser,
): string | null {
  // Sort acc by reverse line number
  lazyBlockReplacements
    .sort((a, b) => a.nodeToReplace.startIndex - b.nodeToReplace.startIndex)
    .reverse();

  // Reconstruct entire file by replacing lazy blocks with the replacement nodes
  const oldFileLines = oldFile.split("\n");
  const newFileChars = newFile.split("");
  for (const {
    nodeToReplace: lazyBlockNode,
    replacementNodes,
  } of lazyBlockReplacements) {
    // Get the full string from the replacement nodes
    let replacementText = "";
    if (replacementNodes.length > 0) {
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
      replacementText = replacementLines.join("\n");

      // Replace the lazy block
      newFileChars.splice(
        lazyBlockNode.startIndex,
        lazyBlockNode.text.length,
        replacementText,
      );
    } else {
      // If there are no replacements, then we want to strip the surrounding whitespace
      // The example in calculator-exp.js.diff is a test where this is necessary
      const lazyBlockStart = lazyBlockNode.startIndex;
      const lazyBlockEnd = lazyBlockNode.endIndex - 1;

      // Remove leading whitespace up to two new lines
      let startIndex = lazyBlockStart;
      let newLinesFound = 0;
      while (
        startIndex > 0 &&
        newFileChars[startIndex - 1]?.trim() === "" &&
        newLinesFound < 2
      ) {
        startIndex--;
        if (newFileChars[startIndex - 1] === "\n") {
          newLinesFound++;
        }
      }

      // Remove trailing whitespace up to two new lines
      const charAfter = newFileChars[lazyBlockEnd + 1];
      const secondCharAfter = newFileChars[lazyBlockEnd + 2];
      let endIndex = lazyBlockEnd;
      if (charAfter === "\n") {
        endIndex++;
        if (secondCharAfter === "\n") {
          endIndex++;
        }
      }

      // Remove the lazy block
      newFileChars.splice(startIndex, endIndex - startIndex + 1);
    }
  }

  const reconstructedFile = newFileChars.join("");

  // CRITICAL FIX: Validate that the reconstructed code is syntactically valid
  // This prevents IndentationErrors and other syntax errors from corrupting files
  try {
    const tree = parser.parse(reconstructedFile);

    // Check if the tree has any error nodes
    if (tree.rootNode.hasError()) {
      console.warn(
        "Lazy block reconstruction created invalid syntax. Falling back to safer method.",
      );
      return null;
    }

    // Additional check: ensure we didn't create empty function/class bodies
    // Look for function/class definitions followed immediately by another definition
    const hasEmptyBlocks = findInAst(tree.rootNode, (node) => {
      // Check for function definitions, class definitions, etc.
      const isBlockDefinition =
        node.type.includes("function") ||
        node.type.includes("class") ||
        node.type.includes("method");

      if (isBlockDefinition) {
        // Skip TypeScript interface members and other declarations that don't require bodies
        const isInterfaceMember = node.parent?.type.includes("interface");
        const isTypeAliasOrDeclaration =
          node.parent?.type.includes("type_alias") ||
          node.type.includes("signature") ||
          node.type.includes("declaration");
        const isAbstractMethod = node.text.includes("abstract");
        
        // Skip ambient declarations (e.g., declare function foo(): void;)
        const isAmbient = node.text.trim().startsWith("declare ");

        if (isInterfaceMember || isTypeAliasOrDeclaration || isAbstractMethod || isAmbient) {
          return false; // These are allowed to have no body
        }

        // Check if it has a body child
        const body = node.childForFieldName("body");
        if (!body || body.namedChildCount === 0) {
          console.warn(
            `Lazy block reconstruction created empty ${node.type} body. Falling back to safer method.`,
          );
          return true;
        }
      }
      return false;
    });

    if (hasEmptyBlocks) {
      return null;
    }
  } catch (error) {
    console.warn("Failed to parse reconstructed file:", error);
    return null;
  }

  return reconstructedFile;
}

const REMOVAL_PERCENTAGE_THRESHOLD = 0.3;
function shouldRejectDiff(diff: DiffLine[]): boolean {
  const numRemovals = diff.filter((line) => line.type === "old").length;
  if (numRemovals / diff.length > REMOVAL_PERCENTAGE_THRESHOLD) {
    return true;
  }
  return false;
}

function nodeSurroundedInLazyBlocks(
  parser: Parser,

  file: string,
  filename: string,
): { newTree: Parser.Tree; newFile: string } | undefined {
  const ext = path.extname(filename).slice(1);
  const language = LANGUAGES[ext];
  if (language) {
    const newFile = `${language.singleLineComment} ... existing code ...\n\n${file}\n\n${language.singleLineComment} ... existing code...`;
    const newTree = parser.parse(newFile);

    return { newTree, newFile };
  }

  return undefined;
}

// TODO: If we don't have high confidence, return undefined to fall back to slower methods
export async function deterministicApplyLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  /**
   * Using this as a flag to slowly reintroduce lazy applies.
   * With this set, we will only attempt to deterministically apply
   * when there are no lazy blocks and then just replace the whole file,
   * and otherwise never use instant apply
   */
  onlyFullFileRewrite = false,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  onlyFullFileRewrite?: boolean;
}): Promise<DiffLine[] | undefined> {
  const parser = await getParserForFile(filename);
  if (!parser) {
    return undefined;
  }

  const oldTree = parser.parse(oldFile);
  let newTree = parser.parse(newLazyFile);
  let reconstructedNewFile: string | null | undefined = undefined;

  if (onlyFullFileRewrite) {
    if (!isLazyText(newTree.rootNode.text)) {
      const diff = myersDiff(oldFile, newLazyFile);

      if (shouldRejectDiff(diff)) {
        return undefined;
      }

      return diff;
    } else {
      return undefined;
    }
  }

  // If there is no lazy block anywhere, we add our own to the outsides
  // so that large chunks of the file don't get removed
  if (!findInAst(newTree.rootNode, isLazyBlock)) {
    // First, we need to check whether there are matching (similar) nodes at the root level
    const firstSimilarNode = findInAst(oldTree.rootNode, (node) =>
      nodesAreSimilar(node, newTree.rootNode.children[0]),
    );
    if (firstSimilarNode?.parent?.equals(oldTree.rootNode)) {
      // If so, we tack lazy blocks to start and end, and run the usual algorithm
      const result = nodeSurroundedInLazyBlocks(parser, newLazyFile, filename);
      if (result) {
        newLazyFile = result.newFile;
        newTree = result.newTree;
      }
    } else {
      // If not, we need to recursively search for the nodes that are being rewritten,
      // and we apply a slightly different algorithm
      const newCodeNumLines = newTree.rootNode.text.split("\n").length;
      const matchingNode = findInAst(
        oldTree.rootNode,
        (node) => programNodeIsSimilar(newTree.rootNode, node),
        // This isn't perfect—we want the length of the matching code in the old tree
        // and the new version could have more lines, or fewer. But should work a lot.
        (node) => node.text.split("\n").length >= newCodeNumLines,
      );
      if (matchingNode) {
        // Now that we've successfully matched the node from the old tree,
        // we create the full new lazy file
        const startIndex = matchingNode.startIndex;
        const endIndex = matchingNode.endIndex;
        const oldText = oldTree.rootNode.text;
        reconstructedNewFile =
          oldText.slice(0, startIndex) +
          newTree.rootNode.text +
          oldText.slice(endIndex);
      } else {
        console.warn("No matching node found for lazy block");
        return undefined;
      }
    }
  }

  if (!reconstructedNewFile) {
    const replacements: AstReplacements = [];
    findLazyBlockReplacements(oldTree.rootNode, newTree.rootNode, replacements);

    reconstructedNewFile = reconstructNewFile(
      oldFile,
      newLazyFile,
      replacements,
      parser,
    );

    // If reconstruction validation failed, fall back to safer method
    if (!reconstructedNewFile) {
      console.warn(
        "Reconstruction validation failed. Falling back to safer method.",
      );
      return undefined;
    }
  }

  const diff = myersDiff(oldFile, reconstructedNewFile);

  // If the diff is too messy and seems likely borked, we fall back to LLM strategy
  if (shouldRejectDiff(diff)) {
    return undefined;
  }

  return diff;
}

function isLazyBlock(node: Parser.SyntaxNode): boolean {
  // Special case for "{/* ... existing code ... */}"
  if (
    node.type === "jsx_expression" &&
    node.namedChildCount === 1 &&
    isLazyBlock(node.namedChildren[0])
  ) {
    return true;
  }

  return node.type.includes("comment") && isLazyText(node.text);
}

function stringsWithinLevDistThreshold(
  a: string,
  b: string,
  threshold: number,
) {
  const dist = distance(a, b);
  return dist / Math.min(a.length, b.length) <= threshold;
}

function programNodeIsSimilar(
  programNode: Parser.SyntaxNode,
  otherNode: Parser.SyntaxNode,
): boolean {
  // Check purely based on whether they are similar strings
  const newLines = programNode.text.split("\n");
  const oldLines = otherNode.text.split("\n");

  // Check that there is a line that matches the start of the old range
  const oldFirstLine = oldLines[0].trim();
  let matchForOldFirstLine = -1;
  for (let i = 0; i < newLines.length; i++) {
    if (newLines[i].trim() === oldFirstLine) {
      matchForOldFirstLine = i;
      break;
    }
  }

  if (matchForOldFirstLine < 0) {
    return false;
  }

  // Check that the last lines match each other
  const oldLastLine = oldLines[oldLines.length - 1].trim();
  const newLastLine = newLines[newLines.length - 1].trim();
  if (oldLastLine !== newLastLine) {
    return false;
  }

  // Check that the number of matching lines is at least half of the shorter length
  let matchingLines = 0;
  for (let i = 0; i < Math.min(newLines.length, oldLines.length); i++) {
    if (oldLines[i].trim() === newLines[matchForOldFirstLine + i].trim()) {
      matchingLines += 1;
    }
  }

  if (matchingLines >= Math.max(newLines.length, oldLines.length) / 2) {
    return true;
  }

  return false;
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

  // Check if they have the same name field (exact match required)
  if (
    a.childForFieldName("name") !== null &&
    a.childForFieldName("name")?.text === b.childForFieldName("name")?.text
  ) {
    return true;
  }

  // CRITICAL FIX: If nodes have a name field but names DON'T match, they are NOT similar
  // This prevents matching functions like calculate_tax() and calculate_total()
  if (
    a.childForFieldName("name") !== null &&
    b.childForFieldName("name") !== null &&
    a.childForFieldName("name")?.text !== b.childForFieldName("name")?.text
  ) {
    return false;
  }

  if (
    a.namedChildren[0]?.text === b.namedChildren[0]?.text &&
    a.children[1]?.text === b.children[1]?.text
  ) {
    return true;
  }

  // Matching jsx_elements needs to be different because they have such a minimal first line
  if (
    a.type === "jsx_element" &&
    b.type === "jsx_element" &&
    // Check that the tag names match
    a.namedChildren[0]?.children[1]?.text ===
      b.namedChildren[0]?.children[1]?.text
  ) {
    if (stringsWithinLevDistThreshold(a.text, b.text, 0.3)) {
      return true;
    }
  }

  // IMPROVED: Use first 3 lines instead of just first line for better accuracy
  // This prevents false matches between functions with similar signatures but different bodies
  const linesA = a.text.split("\n");
  const linesB = b.text.split("\n");

  // Compare first 3 lines (or all lines if less than 3)
  const linesToCompare = Math.min(3, Math.min(linesA.length, linesB.length));
  const firstLinesA = linesA.slice(0, linesToCompare).join("\n");
  const firstLinesB = linesB.slice(0, linesToCompare).join("\n");

  // TIGHTENED: Reduced threshold from 0.2 (20%) to 0.1 (10%) for stricter matching
  return stringsWithinLevDistThreshold(firstLinesA, firstLinesB, 0.1);
}

function nodesAreExact(a: Parser.SyntaxNode, b: Parser.SyntaxNode): boolean {
  return a.text === b.text;
}

/**
 * Should be like Myers diff, but lazy blocks consume all nodes until the next match
 * @param newNode
 * @param oldNode
 * @returns
 */
function findLazyBlockReplacements(
  oldNode: Parser.SyntaxNode,
  newNode: Parser.SyntaxNode,
  replacements: AstReplacements,
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
      rightChildren.shift();
      continue;
    }

    // Look for the first match of L
    const index = rightChildren.findIndex((node) => nodesAreSimilar(L, node));

    if (index === -1) {
      // No match
      if (isLazy) {
        // Add to replacements if in lazy mode
        currentLazyBlockReplacementNodes.push(L);
      }

      // Consume
      leftChildren.shift();
    } else {
      // Match found, insert all right nodes before the match
      for (let i = 0; i < index; i++) {
        rightChildren.shift();
      }

      // then recurse at the match
      findLazyBlockReplacements(L, rightChildren[0], replacements);

      // then consume L and R
      leftChildren.shift();
      rightChildren.shift();

      // Exit "lazy mode"
      if (isLazy) {
        // Record the replacement lines
        replacements.push({
          nodeToReplace: currentLazyBlockNode!,
          replacementNodes: [...currentLazyBlockReplacementNodes],
        });
        isLazy = false;
        currentLazyBlockReplacementNodes.length = 0;
        currentLazyBlockNode = undefined;
      }
    }
  }

  if (isLazy) {
    replacements.push({
      nodeToReplace: currentLazyBlockNode!,
      replacementNodes: [...currentLazyBlockReplacementNodes, ...leftChildren],
    });
  }

  // Cut out any extraneous lazy blocks
  for (const R of rightChildren) {
    if (isLazyBlock(R)) {
      replacements.push({
        nodeToReplace: R,
        replacementNodes: [],
      });
    }
  }
}
