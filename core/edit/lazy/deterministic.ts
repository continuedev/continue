import path from "path";

import { distance } from "fastest-levenshtein";
import Parser from "web-tree-sitter";

import { DiffLine } from "../..";
import { LANGUAGES } from "../../autocomplete/constants/AutocompleteLanguageInfo";
import { myersDiff } from "../../diff/myers";
import { getParserForFile } from "../../util/treeSitter";

import { findInAst } from "./findInAst";

// Import the unified system for better results

type AstReplacements = Array<{
  nodeToReplace: Parser.SyntaxNode;
  replacementNodes: Parser.SyntaxNode[];
}>;

const LAZY_COMMENT_REGEX = /\.{3}\s*(.+?)\s*\.{3}/;
export function isLazyText(text: string): boolean {
  return LAZY_COMMENT_REGEX.test(text);
}

// TODO: If we don't have high confidence, return undefined to fall back to slower methods
export async function deterministicApplyLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  onlyFullFileRewrite = false,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  onlyFullFileRewrite?: boolean;
}): Promise<DiffLine[] | undefined> {
  // Guard against undefined or invalid newLazyFile input (LLM generation failure)
  if (
    typeof newLazyFile !== "string" ||
    newLazyFile === undefined ||
    newLazyFile === null
  ) {
    return undefined;
  }

  // For now, just use the original implementation
  // The unified system will be called from the index.ts file instead
  const parser = await getParserForFile(filename);
  if (!parser) {
    return undefined;
  }

  const oldTree = parser.parse(oldFile);
  let newTree = parser.parse(newLazyFile);
  let reconstructedNewFile: string | undefined = undefined;

  if (onlyFullFileRewrite) {
    if (!isLazyText(newTree.rootNode.text)) {
      const diff = myersDiff(oldFile, newLazyFile);

      if (shouldRejectDiff(diff, filename)) {
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
    );
  }

  const diff = myersDiff(oldFile, reconstructedNewFile);

  // If the diff is too messy and seems likely borked, we fall back to LLM strategy
  if (shouldRejectDiff(diff, filename)) {
    return undefined;
  }

  return diff;
}

function reconstructNewFile(
  oldFile: string,
  newFile: string,
  lazyBlockReplacements: AstReplacements,
): string {
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

  return newFileChars.join("");
}

const REMOVAL_PERCENTAGE_THRESHOLD = 0.3;

interface ChangeAnalysis {
  removalPercentage: number;
  contentPreservationScore: number; // How much semantic content is preserved
  structuralChangeScore: number; // How much is structural vs content change
  refactoringPatternScore: number; // Detected refactoring patterns
  qualityScore: number; // Overall change quality (0-1, higher = better)
  isLegitimateRefactoring: boolean;
}

function shouldRejectDiff(diff: DiffLine[], filename?: string): boolean {
  const analysis = analyzeChangeQuality(diff, filename);

  // Use sophisticated analysis instead of simple threshold
  if (analysis.isLegitimateRefactoring) {
    return false; // Allow legitimate refactoring regardless of removal percentage
  }

  // Use consistent base threshold for all files - let intelligent analysis handle edge cases
  const baseThreshold = REMOVAL_PERCENTAGE_THRESHOLD;

  // Adjust threshold based on change quality (higher quality = more lenient)
  const adjustedThreshold = baseThreshold + analysis.qualityScore * 0.4;

  return analysis.removalPercentage > adjustedThreshold;
}

function analyzeChangeQuality(
  diff: DiffLine[],
  filename?: string,
): ChangeAnalysis {
  const removedLines = diff.filter((line) => line.type === "old");
  const addedLines = diff.filter((line) => line.type === "new");
  const unchangedLines = diff.filter((line) => line.type === "same");

  const removalPercentage = removedLines.length / diff.length;

  // 1. Content Preservation Analysis
  const contentPreservationScore = calculateContentPreservation(
    removedLines,
    addedLines,
  );

  // 2. Structural Change Analysis
  const structuralChangeScore = calculateStructuralChangeScore(
    removedLines,
    addedLines,
    filename,
  );

  // 3. Refactoring Pattern Detection
  const refactoringPatternScore = detectRefactoringPatterns(
    removedLines,
    addedLines,
    filename,
  );

  // 4. Calculate overall quality score
  const qualityScore =
    contentPreservationScore * 0.4 +
    structuralChangeScore * 0.3 +
    refactoringPatternScore * 0.3;

  // 5. Determine if this is legitimate refactoring
  const isLegitimateRefactoring =
    qualityScore > 0.7 || // High overall quality
    (contentPreservationScore > 0.8 && structuralChangeScore > 0.6) || // Mostly moving code
    refactoringPatternScore > 0.8; // Clear refactoring pattern

  return {
    removalPercentage,
    contentPreservationScore,
    structuralChangeScore,
    refactoringPatternScore,
    qualityScore,
    isLegitimateRefactoring,
  };
}

function calculateContentPreservation(
  removedLines: DiffLine[],
  addedLines: DiffLine[],
): number {
  if (removedLines.length === 0 && addedLines.length === 0) return 1.0;
  if (removedLines.length === 0 || addedLines.length === 0) return 0.0;

  // Extract significant content (identifiers, keywords, strings)
  const removedContent = extractSignificantContent(
    removedLines.map((line) => line.line),
  );
  const addedContent = extractSignificantContent(
    addedLines.map((line) => line.line),
  );

  if (removedContent.length === 0 && addedContent.length === 0) return 1.0;

  // Calculate how much content was preserved using intersection over union
  const removedSet = new Set(removedContent);
  const addedSet = new Set(addedContent);

  const intersection = new Set([...removedSet].filter((x) => addedSet.has(x)));
  const union = new Set([...removedSet, ...addedSet]);

  // Jaccard similarity: intersection / union (always 0-1)
  return union.size > 0 ? intersection.size / union.size : 0;
}

function calculateStructuralChangeScore(
  removedLines: DiffLine[],
  addedLines: DiffLine[],
  filename?: string,
): number {
  // Analyze whether changes are primarily structural (moving code) vs content changes
  const removedText = removedLines.map((line) => line.line.trim()).join("\n");
  const addedText = addedLines.map((line) => line.line.trim()).join("\n");

  // Count structural indicators vs content indicators
  let structuralScore = 0;

  // 1. Check for moved functions/classes (same names in different positions)
  const removedFunctions = extractFunctionNames(removedText);
  const addedFunctions = extractFunctionNames(addedText);
  const movedFunctions = removedFunctions.filter((fn) =>
    addedFunctions.includes(fn),
  );
  if (removedFunctions.length > 0) {
    structuralScore += (movedFunctions.length / removedFunctions.length) * 0.4;
  }

  // 2. Check for import/export reorganization
  const removedImports = countMatches(
    removedText,
    /import\s+.*from|export\s+/g,
  );
  const addedImports = countMatches(addedText, /import\s+.*from|export\s+/g);
  if (removedImports > 0 && addedImports > 0) {
    structuralScore += Math.min(addedImports / removedImports, 1) * 0.3;
  }

  // 3. Check for test structure changes (describe/test blocks)
  if (filename?.includes("test") || /describe|test|it/.test(removedText)) {
    const removedTestBlocks = countMatches(
      removedText,
      /describe\s*\(|test\s*\(|it\s*\(/g,
    );
    const addedTestBlocks = countMatches(
      addedText,
      /describe\s*\(|test\s*\(|it\s*\(/g,
    );
    if (removedTestBlocks > 0) {
      structuralScore += Math.min(addedTestBlocks / removedTestBlocks, 1) * 0.3;
    }
  }

  return Math.min(structuralScore, 1.0);
}

function detectRefactoringPatterns(
  removedLines: DiffLine[],
  addedLines: DiffLine[],
  filename?: string,
): number {
  const removedText = removedLines.map((line) => line.line).join("\n");
  const addedText = addedLines.map((line) => line.line).join("\n");

  let patternScore = 0;
  let patternCount = 0;

  // Pattern 1: Test flattening (removing nested describe blocks)
  if (filename?.includes("test") || /describe|test|it/.test(removedText)) {
    const removedDescribeNesting = countMatches(
      removedText,
      /describe\s*\([^)]*,\s*\(\s*\)\s*=>\s*{/g,
    );
    const addedDescribeNesting = countMatches(
      addedText,
      /describe\s*\([^)]*,\s*\(\s*\)\s*=>\s*{/g,
    );

    if (removedDescribeNesting > addedDescribeNesting) {
      patternScore += 0.9; // Strong indicator of test flattening
      patternCount++;
    }
  }

  // Pattern 2: Import consolidation
  const removedImportLines = countMatches(removedText, /^import\s+/gm);
  const addedImportLines = countMatches(addedText, /^import\s+/gm);
  if (removedImportLines > addedImportLines && addedImportLines > 0) {
    patternScore += 0.7; // Import consolidation
    patternCount++;
  }

  // Pattern 3: Function extraction/movement - Enhanced detection
  const functionExtractionScore = detectFunctionExtraction(
    removedText,
    addedText,
  );
  if (functionExtractionScore > 0.3) {
    patternScore += Math.min(functionExtractionScore + 0.4, 0.9); // Boost for extraction
    patternCount++;
  }

  // Pattern 4: Class refactoring
  const classRefactoringScore = calculateClassRefactoringScore(
    removedText,
    addedText,
  );
  if (classRefactoringScore > 0.6) {
    patternScore += classRefactoringScore;
    patternCount++;
  }

  // Pattern 5: Variable/method renaming
  const renamingScore = detectRenamingPattern(removedText, addedText);
  if (renamingScore > 0.7) {
    patternScore += renamingScore;
    patternCount++;
  }

  // Pattern 6: Code block restructuring (moving between scopes)
  const restructuringScore = detectCodeRestructuring(removedText, addedText);
  if (restructuringScore > 0.6) {
    patternScore += restructuringScore;
    patternCount++;
  }

  // Pattern 7: Method/function inlining
  const inliningScore = detectMethodInlining(removedText, addedText);
  if (inliningScore > 0.6) {
    patternScore += inliningScore;
    patternCount++;
  }

  return patternCount > 0 ? patternScore / patternCount : 0;
}

function detectFunctionExtraction(
  removedText: string,
  addedText: string,
): number {
  // Look for function bodies that appear in both removed and added text
  const removedFunctionBodies = extractFunctionBodies(removedText);
  const addedFunctionBodies = extractFunctionBodies(addedText);

  if (removedFunctionBodies.length === 0) return 0;

  let matchingBodies = 0;
  for (const removedBody of removedFunctionBodies) {
    for (const addedBody of addedFunctionBodies) {
      // Check for similar function bodies (allowing for minor formatting differences)
      const similarity = calculateTextSimilarity(removedBody, addedBody);
      if (similarity > 0.8) {
        matchingBodies++;
        break;
      }
    }
  }

  // High score if we found matching function bodies (extraction pattern)
  return matchingBodies / removedFunctionBodies.length;
}

function detectRenamingPattern(removedText: string, addedText: string): number {
  // Extract identifiers and check for systematic renaming
  const removedIdentifiers = extractIdentifiers(removedText);
  const addedIdentifiers = extractIdentifiers(addedText);

  if (removedIdentifiers.length === 0 || addedIdentifiers.length === 0)
    return 0;

  // Look for cases where most content is the same but identifiers changed
  const removedSet = new Set(removedIdentifiers);
  const addedSet = new Set(addedIdentifiers);
  const intersection = new Set([...removedSet].filter((x) => addedSet.has(x)));

  // If few identifiers overlap but structure is similar, likely renaming
  const overlapRatio =
    intersection.size / Math.max(removedSet.size, addedSet.size);
  const structureSimilarity = calculateTextSimilarity(
    removedText.replace(/\b\w+\b/g, "X"), // Replace identifiers with X
    addedText.replace(/\b\w+\b/g, "X"),
  );

  return overlapRatio < 0.5 && structureSimilarity > 0.7 ? 0.8 : 0;
}

function detectCodeRestructuring(
  removedText: string,
  addedText: string,
): number {
  // Look for code blocks that moved between scopes (class methods, standalone functions, etc.)
  const removedBlocks = extractCodeBlocks(removedText);
  const addedBlocks = extractCodeBlocks(addedText);

  if (removedBlocks.length === 0) return 0;

  let movedBlocks = 0;
  for (const removedBlock of removedBlocks) {
    for (const addedBlock of addedBlocks) {
      const similarity = calculateTextSimilarity(removedBlock, addedBlock);
      if (similarity > 0.7) {
        movedBlocks++;
        break;
      }
    }
  }

  return movedBlocks / removedBlocks.length;
}

function detectMethodInlining(removedText: string, addedText: string): number {
  // Enhanced method inlining detection

  // 1. Look for method definitions being removed and their content appearing inline
  const removedMethods = extractMethodDefinitions(removedText);
  const removedCalls = extractMethodCalls(removedText);

  if (removedMethods.length === 0 || removedCalls.length === 0) return 0;

  let inliningScore = 0;
  let inliningCount = 0;

  for (const method of removedMethods) {
    // Check if this method was being called in the removed text
    const wasCalledInRemoved = removedCalls.some(
      (call) =>
        call.methodName === method.name || call.call.includes(method.name),
    );

    if (wasCalledInRemoved) {
      // Check if the method body content appears in the added text
      const methodBodySimilarity = findMethodBodyInAddedText(
        method.body,
        addedText,
      );
      if (methodBodySimilarity > 0.6) {
        inliningScore += methodBodySimilarity;
        inliningCount++;
      }
    }
  }

  return inliningCount > 0 ? inliningScore / inliningCount : 0;
}

function extractMethodDefinitions(
  text: string,
): Array<{ name: string; body: string }> {
  const methods: Array<{ name: string; body: string }> = [];

  // Match method definitions: methodName(params) { body }
  const methodRegex = /(\w+)\s*\([^)]*\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/g;
  let match;

  while ((match = methodRegex.exec(text)) !== null) {
    const name = match[1];
    const body = match[2].trim();

    // Skip common non-method patterns
    if (
      !["if", "for", "while", "switch", "try", "catch"].includes(name) &&
      body.length > 5
    ) {
      methods.push({ name, body });
    }
  }

  return methods;
}

function findMethodBodyInAddedText(
  methodBody: string,
  addedText: string,
): number {
  // Remove common formatting and check for content similarity
  const normalizedMethodBody = methodBody.replace(/\s+/g, " ").trim();
  const normalizedAddedText = addedText.replace(/\s+/g, " ").trim();

  // Extract meaningful statements from method body
  const methodStatements = extractStatements(normalizedMethodBody);
  const addedStatements = extractStatements(normalizedAddedText);

  if (methodStatements.length === 0) return 0;

  let matchingStatements = 0;
  for (const stmt of methodStatements) {
    if (
      addedStatements.some(
        (addedStmt) => calculateTextSimilarity(stmt, addedStmt) > 0.7,
      )
    ) {
      matchingStatements++;
    }
  }

  return matchingStatements / methodStatements.length;
}

function extractStatements(text: string): string[] {
  // Split by semicolons and filter meaningful statements
  return text
    .split(/[;{}]/)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 10 && !stmt.startsWith("//"))
    .slice(0, 10); // Limit to avoid performance issues
}

// Helper functions for pattern detection
function extractFunctionBodies(text: string): string[] {
  const bodies: string[] = [];
  const functionRegex =
    /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(\w+)\s*\([^)]*\)\s*{)/g;

  let match;
  while ((match = functionRegex.exec(text)) !== null) {
    const startIndex = match.index;
    const braceIndex = text.indexOf("{", startIndex);
    if (braceIndex !== -1) {
      const body = extractBalancedBraces(text, braceIndex);
      if (body && body.length > 10) {
        bodies.push(body);
      }
    }
  }

  return bodies;
}

function extractBalancedBraces(text: string, startIndex: number): string {
  let braceCount = 0;
  let i = startIndex;

  do {
    if (text[i] === "{") braceCount++;
    if (text[i] === "}") braceCount--;
    i++;
  } while (i < text.length && braceCount > 0);

  return text.slice(startIndex, i);
}

function extractIdentifiers(text: string): string[] {
  const identifiers = text.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
  // Filter out common keywords
  const keywords = [
    "function",
    "const",
    "let",
    "var",
    "if",
    "else",
    "for",
    "while",
    "return",
    "class",
    "import",
    "export",
  ];
  return identifiers.filter((id) => !keywords.includes(id) && id.length > 1);
}

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  // Extract function definitions, class methods, etc.
  const blockRegex = /{[^{}]*(?:{[^{}]*}[^{}]*)*}/g;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    if (match[0].length > 20) {
      // Ignore trivial blocks
      blocks.push(match[0]);
    }
  }

  return blocks;
}

function extractMethodCalls(
  text: string,
): Array<{ methodName: string; call: string }> {
  const calls: Array<{ methodName: string; call: string }> = [];
  const callRegex = /(\w+)\s*\([^)]*\)/g;
  let match;

  while ((match = callRegex.exec(text)) !== null) {
    calls.push({
      methodName: match[1],
      call: match[0],
    });
  }

  return calls;
}

function extractPotentialInlinedCode(text: string): string[] {
  // Look for code blocks that might be inlined method bodies
  return text
    .split("\n")
    .filter((line) => line.trim().length > 10)
    .map((line) => line.trim());
}

function calculateTextSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1.0;
  if (!text1 || !text2) return 0.0;

  // Simple similarity based on common subsequences
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

function extractSignificantContent(lines: string[]): string[] {
  const content: string[] = [];
  const text = lines.join("\n");

  // Extract function names
  const functions = text.match(/function\s+(\w+)|(\w+)\s*\(/g) || [];
  content.push(...functions);

  // Extract class names
  const classes = text.match(/class\s+(\w+)/g) || [];
  content.push(...classes);

  // Extract variable declarations
  const variables = text.match(/(?:const|let|var)\s+(\w+)/g) || [];
  content.push(...variables);

  // Extract string literals (API endpoints, test names, etc.)
  const strings = text.match(/"[^"]{5,}"|'[^']{5,}'/g) || [];
  content.push(...strings);

  return content.map((c) => c.trim()).filter((c) => c.length > 2);
}

function extractFunctionNames(text: string): string[] {
  const matches =
    text.match(
      /function\s+(\w+)|(\w+)\s*(?=\s*[=:]\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{|function))/g,
    ) || [];
  return matches
    .map((match) => {
      const nameMatch = match.match(/function\s+(\w+)|(\w+)/);
      return nameMatch ? nameMatch[1] || nameMatch[2] : "";
    })
    .filter((name) => name.length > 0);
}

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function calculateFunctionMovementScore(
  removedText: string,
  addedText: string,
): number {
  const removedFunctions = extractFunctionNames(removedText);
  const addedFunctions = extractFunctionNames(addedText);

  if (removedFunctions.length === 0) return 0;

  const movedFunctions = removedFunctions.filter((fn) =>
    addedFunctions.includes(fn),
  );
  return movedFunctions.length / removedFunctions.length;
}

function calculateClassRefactoringScore(
  removedText: string,
  addedText: string,
): number {
  const removedClasses = (removedText.match(/class\s+(\w+)/g) || []).map(
    (match) => match.split(/\s+/)[1],
  );
  const addedClasses = (addedText.match(/class\s+(\w+)/g) || []).map(
    (match) => match.split(/\s+/)[1],
  );

  if (removedClasses.length === 0) return 0;

  const preservedClasses = removedClasses.filter((cls) =>
    addedClasses.includes(cls),
  );
  return preservedClasses.length / removedClasses.length;
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

  // Check if they have the same name
  if (
    a.childForFieldName("name") !== null &&
    a.childForFieldName("name")?.text === b.childForFieldName("name")?.text
  ) {
    return true;
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

  const lineOneA = a.text.split("\n")[0];
  const lineOneB = b.text.split("\n")[0];

  return stringsWithinLevDistThreshold(lineOneA, lineOneB, 0.2);
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
