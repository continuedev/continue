import Parser from "web-tree-sitter";
import { Chunk, IDE, ILLM, Position, Range, RangeInFile } from "..";
import { getAst } from "../autocomplete/util/ast";
import { NEXT_EDIT_MODELS } from "../llm/constants";
import { DocumentHistoryTracker } from "./DocumentHistoryTracker";
import { MODEL_WINDOW_SIZES } from "./constants";

export enum EditableRegionStrategy {
  Naive = "naive",
  Sliding = "sliding",
  Rerank = "rerank",
  StaticRerank = "staticRerank",
  Static = "static",
}

/**
 * This was an attempt to find next edit locations deterministically.
 * I was intending to use this in tandem with the prefetching logic, but we are not using it anymore.
 */
export async function getNextEditableRegion(
  strategy: EditableRegionStrategy,
  ctx: any,
): Promise<RangeInFile[] | null> {
  switch (strategy) {
    case EditableRegionStrategy.Naive:
      return naiveJump(ctx);
    case EditableRegionStrategy.Sliding:
      return slidingJump(ctx);
    case EditableRegionStrategy.Rerank:
      return await rerankJump(ctx);
    case EditableRegionStrategy.StaticRerank:
      return await staticRerankJump(ctx);
    case EditableRegionStrategy.Static:
      return await staticJump(ctx);
    default:
      return null;
  }
}

// Naive assumes that the entire file is editable.
// This relies on the next edit model to figure out where to jump next.
function naiveJump(ctx: any): RangeInFile[] | null {
  const { fileLines, filepath } = ctx;
  if (!fileLines || !filepath) {
    console.warn("Missing required context for naive jump");
    return null;
  }

  return [
    {
      filepath,
      range: {
        start: { line: 0, character: 0 },
        end: {
          line: fileLines.length - 1,
          character: fileLines.at(-1).length,
        },
      },
    },
  ];
}

// Sliding splits the file using into sliding window.
function slidingJump(ctx: any): RangeInFile[] | null {
  const { fileLines, filepath, modelName, currentCursorPos } = ctx;
  if (!fileLines || !filepath || !modelName || !currentCursorPos) {
    console.warn("Missing required context for sliding jump");
    return null;
  }

  const topMargin = MODEL_WINDOW_SIZES[modelName as NEXT_EDIT_MODELS].topMargin;
  const bottomMargin =
    MODEL_WINDOW_SIZES[modelName as NEXT_EDIT_MODELS].bottomMargin;
  const windowSize = topMargin + bottomMargin + 1; // 1 for current line

  if (fileLines.length <= windowSize) {
    return [
      {
        filepath,
        range: {
          start: { line: 0, character: 0 },
          end: {
            line: fileLines.length - 1,
            character: fileLines[fileLines.length - 1].length,
          },
        },
      },
    ];
  }

  const ranges: RangeInFile[] = [];
  const cursorLine = currentCursorPos.line;

  // Create the first window centered around the cursor position
  const firstWindowStart = Math.max(0, cursorLine - topMargin);
  const firstWindowEnd = Math.min(
    fileLines.length - 1,
    cursorLine + bottomMargin,
  );

  ranges.push({
    filepath,
    range: {
      start: { line: firstWindowStart, character: 0 },
      end: {
        line: firstWindowEnd,
        character: fileLines[firstWindowEnd].length,
      },
    },
  });

  // Alternating pattern: down once, up once, repeat
  const slidingStep = Math.max(1, Math.floor(windowSize / 2));
  let currentStartDown = firstWindowEnd + 1;
  let currentStartUp = firstWindowStart - slidingStep;
  while (currentStartDown < fileLines.length || currentStartUp >= 0) {
    // Go down once
    if (currentStartDown < fileLines.length) {
      const windowStart = currentStartDown;
      const windowEnd = Math.min(
        windowStart + windowSize - 1,
        fileLines.length - 1,
      );

      ranges.push({
        filepath,
        range: {
          start: { line: windowStart, character: 0 },
          end: {
            line: windowEnd,
            character: fileLines[windowEnd].length,
          },
        },
      });

      currentStartDown += slidingStep;
    }

    // Go up once
    if (currentStartUp >= 0) {
      const windowStart = Math.max(0, currentStartUp);
      const windowEnd = Math.min(
        windowStart + windowSize - 1,
        fileLines.length - 1,
      );

      ranges.push({
        filepath,
        range: {
          start: { line: windowStart, character: 0 },
          end: {
            line: windowEnd,
            character: fileLines[windowEnd].length,
          },
        },
      });

      currentStartUp -= slidingStep;
    }
  }

  return ranges;
}

// A rerank jump splits the current file into chunks.
// Then it uses a rerank model to get the most relevant chunks and their positions.
async function rerankJump(ctx: {
  fileContent: string;
  query: string;
  filepath: string;
  reranker: ILLM;
  chunkSize: number;
}): Promise<RangeInFile[] | null> {
  try {
    const { fileContent, query, filepath, reranker, chunkSize = 5 } = ctx;

    if (!fileContent || !query || !filepath || !reranker) {
      console.warn(
        "Missing required context for rerank jump:",
        !fileContent,
        !query,
        !filepath,
        !reranker,
      );
      return null;
    }

    const lines = fileContent.split("\n");
    const chunks: Chunk[] = [];

    // Create chunks from the file.
    for (let i = 0; i < lines.length; i += Math.floor(chunkSize / 2)) {
      const endLine = Math.min(i + chunkSize - 1, lines.length - 1);
      const chunkContent = lines.slice(i, endLine + 1).join("\n");
      if (chunkContent === "") continue; // Voyager throws an error if there are empty strings in its document field in the body.
      chunks.push({
        content: chunkContent,
        startLine: i,
        endLine: endLine,
        digest: `chunk-${i}-${endLine}`,
        filepath: filepath,
        index: i,
      });
    }

    // Use the reranker to score each chunk against the query.
    const scores = await reranker.rerank(query, chunks);

    // Sort by score in descending order and get the highest scoring chunk.
    chunks.sort(
      (a, b) => scores[chunks.indexOf(b)] - scores[chunks.indexOf(a)],
    );

    // const mostRelevantChunk = chunks[0];
    // Get the third most relevant chunk if there are enough chunks,
    // otherwise fallback to second or first.
    // The most relevant chunk seems to be the one that
    // is similar enough lexically,
    // but different enough to still justify making an edit.
    const chunkIndex = Math.min(2, chunks.length - 1);
    const mostRelevantChunk = chunks[chunkIndex];

    // Return the range of the most relevant chunk.
    // NOTE: It might be better to return a list of chunks,
    // because it's very difficult to gauge when to stop the model.
    // We could argue that we should always try to jump until the user says no.
    return [
      {
        filepath,
        range: {
          start: { line: mostRelevantChunk.startLine, character: 0 },
          end: {
            line: mostRelevantChunk.endLine,
            character: lines[mostRelevantChunk.endLine].length,
          },
        },
      },
    ];
  } catch (error) {
    console.error("Error in rerank jump:", error);
    return null;
  }
}

// A static rerank jump runs a lightweight static analysis on the file
// and uses the reranker to jump to relevant locations.
async function staticRerankJump(ctx: {
  oldFileContent: string;
  newFileContent: string;
  completionRange: Range;
  filepath: string;
  ide: IDE;
  reranker?: ILLM;
  chunkSize?: number;
}): Promise<RangeInFile[] | null> {
  try {
    const { oldFileContent, newFileContent, completionRange, filepath, ide } =
      ctx;

    if (
      !oldFileContent ||
      !newFileContent ||
      !completionRange ||
      !filepath ||
      !ide
    ) {
      console.warn(
        "Missing required context for static rerank jump:",
        !oldFileContent,
        !newFileContent,
        !completionRange,
        !filepath,
        !ide,
      );
      return null;
    }

    // TODO:
    // Parse the old file contents into an AST.
    // Parse the new file contents into an AST.
    // Compare the two trees and find which nodes have changed.
    // Save the queue of changed nodes. The queue should contain the old node and the new node. Each of them can be null if the change is a deletion or insertion.
    // Rank the queue by node depth (decreasing order because we want granular edits).
    // Pop front until we find a queue item with an old node != null.
    // Search the codebase for the old node's expression. For this, either use ide.getReferences(some_location), or other methods you see fit. If you can utilize the strategy pattern, even better.
    // For now, filter out results from outside files. We only want to keep the results in the current file.
    // Return the first result from this filtered list of results.

    // Parse the old file contents into an AST.
    const oldAst = await getAst(filepath, oldFileContent);
    if (!oldAst) return null;

    // Parse the new file contents into an AST.
    const newAst = await getAst(filepath, newFileContent);
    if (!newAst) return null;

    // Compare the two trees and find which nodes have changed.
    const changedNodes = compareAsts(oldAst, newAst);
    if (!changedNodes || changedNodes.length === 0) return null;

    // Save the queue of changed nodes.
    // The queue should contain the old node and the new node.
    // Each can be null if the change is a deletion or insertion.
    // const nodeQueue = changedNodes.map((change) => ({
    //   oldNode: change.oldNode,
    //   newNode: change.newNode,
    //   depth: change.depth,
    // }));

    // Rank the queue by node depth.
    // Decreasing order for granular edits.
    // Increasing order for larger definition-based searches.
    // Making it decreasing has issues when the deepest node is a string_fragment.
    const nodeQueue = changedNodes.sort((a, b) => a.depth - b.depth);
    console.log(
      "nodeQueue:",
      nodeQueue.map((node) => ({
        oldText: node.oldNode?.text || "",
        newText: node.newNode?.text || "",
        oldType: node.oldNode?.type || "",
        newType: node.newNode?.type || "",
        depth: node.depth,
      })),
    );

    // Find the first item with a non-null old node.
    let targetNode = null;
    while (nodeQueue.length > 0 && !targetNode) {
      const candidate = nodeQueue.shift();
      if (
        candidate &&
        candidate.oldNode &&
        candidate.oldNode.type !== "program"
      ) {
        targetNode = candidate.oldNode;
      }
    }

    if (!targetNode) return null;

    // Get the text representation of the old node's expression.
    const nodeText = getNodeText(targetNode);
    if (!nodeText || nodeText.trim() === "") return null;

    // Search for similar code in the file.
    let references: RangeInFile[] = [];

    // Try to use IDE's reference finding capabilities if available.
    try {
      // Get the position of the target node in the old file.
      const nodePosition = getNodePosition(targetNode);
      if (nodePosition) {
        // Use IDE to find references.

        // TODO:
        // Get the list of document symbols using await ide.getDocumentSymbols.
        // Each document symbol will be our query.
        // Use the rerank model to rank the nodeText against the query.
        // Get the highest scoring query and its location.

        // Get the list of document symbols using await ide.getDocumentSymbols.
        // Filter out symbols that are directly inside the completion range.
        const symbols = await ide.getDocumentSymbols(filepath);

        // Filter out symbols that are directly inside the completion range
        const filteredSymbols = symbols.filter((symbol) => {
          // Check if the symbol's range is outside of the completion range
          return !doRangesOverlap(symbol.range, completionRange);
        });

        // Use the reranker to rank the filtered symbols against the node text.
        if (!ctx.reranker) {
          console.warn("No reranker available for static jump symbol ranking");
          return null;
        }

        const symbolChunks: Chunk[] = filteredSymbols.map((symbol) => ({
          content: symbol.name,
          startLine: symbol.range.start.line,
          endLine: symbol.range.end.line,
          digest: `symbol-${symbol.name}-${symbol.range.start.line}`,
          filepath: filepath,
          index: symbol.range.start.line,
        }));

        if (symbolChunks.length === 0) {
          console.warn("No symbols found for ranking");
          return null;
        }

        const scores = await ctx.reranker.rerank(nodeText, symbolChunks);
        symbolChunks.sort(
          (a, b) =>
            scores[symbolChunks.indexOf(b)] - scores[symbolChunks.indexOf(a)],
        );

        const mostRelevantSymbol = symbolChunks[0];
        const originalSymbol = filteredSymbols.find(
          (symbol) =>
            symbol.range.start.line === mostRelevantSymbol.startLine &&
            symbol.range.end.line === mostRelevantSymbol.endLine,
        );

        if (originalSymbol) {
          references = [
            {
              filepath,
              range: originalSymbol.range,
            },
          ];
        }

        // const foundReferences = await ide.getReferences({
        //   filepath,
        //   position: nodePosition,
        // });

        // if (foundReferences && foundReferences.length > 0) {
        //   references = foundReferences;
        // }
      }
    } catch (e) {
      console.warn(
        "Failed to use IDE references, falling back to text search:",
        e,
      );
    }

    // If IDE reference finding failed or returned no results, fall back to text search.
    if (references.length === 0) {
      references = findTextOccurrences(oldFileContent, nodeText).map(
        (range) => ({ filepath, range }),
      );
    }

    // Filter out results from outside the current file.
    const currentFileReferences = references.filter(
      (ref) => ref.filepath === filepath,
    );

    // Return the first reference if any found.
    if (currentFileReferences.length > 0) {
      return [currentFileReferences[0]];
      // return currentFileReferences;
    }

    return null;
  } catch (error) {
    console.error("Error in static jump:", error);
    return null;
  }
}

// Static jump relies purely on static analysis
// to determine where to edit next.
async function staticJump(ctx: {
  cursorPosition: { line: number; character: number };
  filepath: string;
  ide: IDE;
}): Promise<RangeInFile[] | null> {
  try {
    const { cursorPosition, filepath, ide } = ctx;
    if (!cursorPosition || !filepath || !ide) {
      console.warn(
        "Missing required context for static jump:",
        !cursorPosition,
        !filepath,
        !ide,
      );
      return null;
    }

    // Get the file's AST.
    // Getting this once helps us live-track the current node.
    const tree =
      await DocumentHistoryTracker.getInstance().getMostRecentAst(filepath);
    // const tree = await getAst(filepath, fileContent);
    if (!tree) return null;

    // Convert cursor position to tree-sitter point format (0-based).
    const point = {
      row: cursorPosition.line,
      column: cursorPosition.character,
    };

    // Find the node at the cursor position.
    const nodeAtCursor = tree.rootNode.descendantForPosition(point);
    if (!nodeAtCursor) {
      console.log("No node found at cursor position");
      return null;
    }

    // Find the closest identifier node.
    const identifierNode = findClosestIdentifierNode(nodeAtCursor);
    if (!identifierNode) {
      console.log("No identifier node found near cursor position");
      return null;
    }
    // console.log("closest identifier:", identifierNode.text);

    // Get all references to this identifier using the IDE's API
    const references = await ide.getReferences({
      filepath,
      position: {
        line: identifierNode.startPosition.row,
        character: identifierNode.startPosition.column,
      },
    });

    if (!references || references.length === 0) {
      console.log(`No references found for identifier: ${identifierNode.text}`);
      return null;
    }

    // console.log(
    //   "references:",
    //   JSON.stringify(
    //     references.map((ref) => ({
    //       line: ref.range.start.line,
    //       character: ref.range.start.character,
    //     })),
    //     null,
    //     2,
    //   ),
    // );

    return references.length > 1 ? references.slice(1) : null;
  } catch (error) {
    console.error("Error in staticJump:", error);
    return null;
  }
}

/* AST HELPER FUNCTIONS */

// Helper function to find the closest identifier node.
function findClosestIdentifierNode(
  node: Parser.SyntaxNode | null,
): Parser.SyntaxNode | null {
  if (!node) return null;

  if (isIdentifierNode(node)) return node;
  if (isDeclarationNode(node)) return findLeftmostIdentifier(node);

  // Check if the parent is an identifier.
  // NOTE: This will probably never get triggered.
  // Most identifiers are leaf nodes.
  const parent = node.parent;
  if (parent && isIdentifierNode(parent)) {
    return parent;
  }

  if (parent) {
    if (isDeclarationNode(parent)) return findLeftmostIdentifier(parent);

    // Check if one of the siblings is an identifier.
    for (let i = 0; i < parent.childCount; ++i) {
      // const sibling = node.child(i);
      const sibling = parent.child(i);
      if (sibling && isIdentifierNode(sibling)) {
        // Get the leftmost identifier sibling.
        return sibling;
      }
    }
  }

  return findClosestIdentifierNode(parent);
}

function findLeftmostIdentifier(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | null {
  if (isIdentifierNode(node)) return node;

  for (let i = 0; i < node.childCount; ++i) {
    const child = node.child(i);
    if (child) {
      const result = findLeftmostIdentifier(child);
      if (result) return result;
    }
  }

  return null;
}

// Helper function to check if a node is an identifier.
function isIdentifierNode(node: Parser.SyntaxNode) {
  const nodeType = node.type;

  if (nodeType === "identifier") return true;
  if (nodeType.includes("identifier")) return true;

  // Most language grammars will use the term "identifier".
  // However some might not.
  // Update this as they come.
  const specialIdentifiers = ["name", "constant"];
  return specialIdentifiers.includes(nodeType);
}

// Helper function to check if a node is a declaration.
function isDeclarationNode(node: Parser.SyntaxNode) {
  const nodeType = node.type;

  // Common declaration patterns.
  if (nodeType.endsWith("_declaration")) return true;
  if (nodeType.endsWith("_definition")) return true;
  if (nodeType.endsWith("_item")) return true; // Rust.

  // Language-specific patterns.
  const declarationTypes = [
    // Python.
    "function_definition",
    "class_definition",
    "async_function_definition",
    "decorated_definition",

    // Ruby.
    "method",
    "class",
    "module",
    "singleton_method",

    // Java.
    "variable_declarator",
    "local_variable_declaration",

    // Go.
    "short_var_declaration",

    // General
    "method_definition",
  ];

  return declarationTypes.includes(nodeType);
}

// // Helper function to find the closest identifier node.
// function findClosestIdentifierNode(
//   node: Parser.SyntaxNode | undefined,
// ): Parser.SyntaxNode | undefined {
//   if (!node) return undefined;

//   // Check if the current node is an identifier
//   if (isIdentifierLike(node)) {
//     return node;
//   }

//   // Check if the parent is an identifier
//   const parent = node.parent;
//   if (parent && isIdentifierLike(parent)) {
//     return parent;
//   }

//   // Check if any of the node's children are identifiers
//   // Return the leftmost identifier child if found
//   for (let i = 0; i < node.childCount; i++) {
//     const child = node.child(i);
//     if (child && isIdentifierLike(child)) {
//       return child;
//     }
//   }

//   // Check if any of the parent's children are identifiers
//   if (parent) {
//     for (let i = 0; i < parent.childCount; i++) {
//       const sibling = parent.child(i);
//       if (sibling && isIdentifierLike(sibling)) {
//         return sibling;
//       }
//     }
//   }

//   // Recurse on the parent if we haven't found anything yet
//   return findClosestIdentifierNode(parent);
// }

// // Helper function to determine if a node is identifier-like
// function isIdentifierLike(node: Parser.SyntaxNode): boolean {
//   // Common identifier node types across languages
//   const commonIdentifierTypes = [
//     "identifier",
//     "property_identifier",
//     "type_identifier",
//     "field_identifier",
//     "variable_identifier",
//     "constant",
//     "symbol",
//   ];

//   if (commonIdentifierTypes.includes(node.type)) {
//     return true;
//   }

//   // Check for common identifier patterns in node types
//   return /identifier$|^identifier|_identifier/.test(node.type);
// }

// Helper function to compare ASTs and find changed nodes.
function compareAsts(oldAst: Parser.Tree, newAst: Parser.Tree) {
  const changedNodes: {
    oldNode: Parser.SyntaxNode | null;
    newNode: Parser.SyntaxNode | null;
    depth: number;
  }[] = [];

  // This is a simplified implementation.
  // In practice, you would traverse both ASTs in parallel
  // and identify nodes that differ.

  function traverse(
    oldNode: Parser.SyntaxNode | null,
    newNode: Parser.SyntaxNode | null,
    depth: number = 0,
  ) {
    if (!oldNode && !newNode) return;

    // If one node exists and the other doesn't, or they're different types.
    if (
      (!oldNode && newNode) ||
      (oldNode && !newNode) ||
      oldNode?.type !== newNode?.type
    ) {
      changedNodes.push({ oldNode, newNode, depth });
      return;
    }

    // Compare properties.
    if (oldNode?.text !== newNode?.text) {
      changedNodes.push({ oldNode, newNode, depth });
    }

    // Recursively compare children.
    const oldChildCount = oldNode?.childCount || 0;
    const newChildCount = newNode?.childCount || 0;

    const maxLength = Math.max(oldChildCount, newChildCount);
    for (let i = 0; i < maxLength; i++) {
      const oldChild = i < oldChildCount ? oldNode?.child(i) || null : null;
      const newChild = i < newChildCount ? newNode?.child(i) || null : null;
      traverse(oldChild, newChild, depth + 1);
    }
  }

  traverse(oldAst.rootNode, newAst.rootNode);
  return changedNodes;
}

// Helper function to get a node's text.
function getNodeText(node: Parser.SyntaxNode): string {
  if (!node) return "";

  return node.text;
}

// Helper function to get a node's position.
function getNodePosition(node: Parser.SyntaxNode): Position | null {
  if (!node) return null;

  // Tree-sitter nodes have startPosition property that contains row and column.
  return {
    line: node.startPosition.row,
    character: node.startPosition.column,
  };
}

/* OTHER HELPER FUNCTIONS */

// Helper function to find all occurrences of text in a string.
function findTextOccurrences(text: string, searchText: string): Range[] {
  const results: Range[] = [];
  const lines = text.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let charIndex = 0;

    while (charIndex < line.length) {
      const foundIndex = line.indexOf(searchText, charIndex);
      if (foundIndex === -1) break;

      results.push({
        start: { line: lineIndex, character: foundIndex },
        end: { line: lineIndex, character: foundIndex + searchText.length },
      });

      charIndex = foundIndex + 1;
    }
  }

  return results;
}

// Helper function to check if a range is within another range.
function isRangeWithin(innerRange: Range, outerRange: Range): boolean {
  // Check if the inner range's start position is after or equal to the outer range's start.
  const startWithin =
    innerRange.start.line > outerRange.start.line ||
    (innerRange.start.line === outerRange.start.line &&
      innerRange.start.character >= outerRange.start.character);

  // Check if the inner range's end position is before or equal to the outer range's end.
  const endWithin =
    innerRange.end.line < outerRange.end.line ||
    (innerRange.end.line === outerRange.end.line &&
      innerRange.end.character <= outerRange.end.character);

  return startWithin && endWithin;
}

// Helper function to check if two ranges overlap.
function doRangesOverlap(range1: Range, range2: Range): boolean {
  // Check if one range starts after the other ends
  const range1StartsAfterRange2Ends =
    range1.start.line > range2.end.line ||
    (range1.start.line === range2.end.line &&
      range1.start.character > range2.end.character);

  const range2StartsAfterRange1Ends =
    range2.start.line > range1.end.line ||
    (range2.start.line === range1.end.line &&
      range2.start.character > range1.end.character);

  // If either condition is true, the ranges don't overlap
  return !(range1StartsAfterRange2Ends || range2StartsAfterRange1Ends);
}

// Helper function to check if the upper part of range1 overlaps with range2.
function doesUpperPartOverlap(range1: Range, range2: Range): boolean {
  // Check if range1 starts before range2 ends
  const range1StartsBeforeRange2Ends =
    range1.start.line < range2.end.line ||
    (range1.start.line === range2.end.line &&
      range1.start.character <= range2.end.character);

  // Check if range1 starts before range2 starts (meaning it's "upper" than range2)
  const range1StartsBeforeRange2Starts =
    range1.start.line < range2.start.line ||
    (range1.start.line === range2.start.line &&
      range1.start.character < range2.start.character);

  // The upper part overlaps if range1 starts before range2 ends
  // AND range1 starts before range2 starts
  return range1StartsBeforeRange2Ends && range1StartsBeforeRange2Starts;
}

// Helper function to check if the lower part of range1 overlaps with range2.
function doesLowerPartOverlap(range1: Range, range2: Range): boolean {
  // Check if range1 starts inside range2
  const range1StartsInsideRange2 =
    (range1.start.line > range2.start.line ||
      (range1.start.line === range2.start.line &&
        range1.start.character >= range2.start.character)) &&
    (range1.start.line < range2.end.line ||
      (range1.start.line === range2.end.line &&
        range1.start.character < range2.end.character));

  // Check if range1 ends after range2 ends
  const range1EndsAfterRange2 =
    range1.end.line > range2.end.line ||
    (range1.end.line === range2.end.line &&
      range1.end.character > range2.end.character);

  // The lower part overlaps if range1 starts inside range2
  // AND range1 ends after range2 ends
  return range1StartsInsideRange2 && range1EndsAfterRange2;
}

// Helper function to check if a range overlaps with another range from either end
function doesRangePartiallyOverlap(range1: Range, range2: Range): boolean {
  // Upper part overlap: range1 starts before range2 starts but ends inside range2
  const upperPartOverlap =
    (range1.start.line < range2.start.line ||
      (range1.start.line === range2.start.line &&
        range1.start.character < range2.start.character)) &&
    (range1.end.line > range2.start.line ||
      (range1.end.line === range2.start.line &&
        range1.end.character > range2.start.character)) &&
    (range1.end.line < range2.end.line ||
      (range1.end.line === range2.end.line &&
        range1.end.character <= range2.end.character));

  // Lower part overlap: range1 starts inside range2 but ends after range2 ends
  const lowerPartOverlap =
    (range1.start.line > range2.start.line ||
      (range1.start.line === range2.start.line &&
        range1.start.character >= range2.start.character)) &&
    (range1.start.line < range2.end.line ||
      (range1.start.line === range2.end.line &&
        range1.start.character < range2.end.character)) &&
    (range1.end.line > range2.end.line ||
      (range1.end.line === range2.end.line &&
        range1.end.character > range2.end.character));

  return upperPartOverlap || lowerPartOverlap;
}

// Utility function to print chunks.
function printChunks(chunks: Chunk[]) {
  console.log(
    "chunks:",
    JSON.stringify(
      chunks.map((chunk) => ({
        content: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
      })),
      null,
      2,
    ),
  );
}
