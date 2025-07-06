import { distance } from "fastest-levenshtein";
import Parser from "web-tree-sitter";
import { DiffLine } from "../../..";
import { deterministicApplyLazyEdit } from "../deterministic";

/**
 * Optimizations for handling out-of-order edits where functions/blocks
 * have been reordered in addition to being modified
 */

interface CodeBlock {
  id: string; // Unique identifier based on content
  type: "function" | "class" | "interface" | "const" | "import" | "export";
  name: string; // Function/class/variable name
  node: Parser.SyntaxNode; // AST node
  contentHash: string; // Hash of normalized content
  dependencies: string[]; // Names of other blocks this depends on
  originalPosition: number; // Original line position
  newPosition?: number; // New line position (if found)
  signature: string; // Normalized signature for matching
  isModified: boolean; // Whether content was changed
  modificationDetails?: ModificationDetails;
}

interface ModificationDetails {
  type: "added" | "removed" | "modified" | "moved";
  oldContent?: string;
  newContent?: string;
  confidence: number;
}

interface ReorderingPattern {
  type:
    | "alphabetical"
    | "dependency"
    | "functional_grouping"
    | "size_based"
    | "custom";
  confidence: number;
  evidence: string[];
}

interface ReorderConfig {
  enableReorderDetection: boolean;
  contentSimilarityThreshold: number; // 0.8 - How similar content must be to match
  positionToleranceRatio: number; // 0.3 - How much position can change
  dependencyAnalysisEnabled: boolean; // Whether to analyze dependencies
  preserveLogicalGrouping: boolean; // Keep related functions together
  minBlocksForReorderDetection: number; // 3 - Minimum blocks to detect reordering
}

const DEFAULT_REORDER_CONFIG: ReorderConfig = {
  enableReorderDetection: true,
  contentSimilarityThreshold: 0.6, // More lenient for modified functions
  positionToleranceRatio: 0.4, // More lenient position changes
  dependencyAnalysisEnabled: true,
  preserveLogicalGrouping: true,
  minBlocksForReorderDetection: 2, // Lower threshold for small classes
};

/**
 * Create a content-based hash for a code block
 */
function createContentHash(node: Parser.SyntaxNode): string {
  // Normalize the content by removing whitespace and comments
  const content = node.text
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
    .replace(/\/\/.*$/gm, "") // Remove line comments
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Simple hash function (could be replaced with crypto.createHash for production)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Extract all code blocks from AST
 */
function extractCodeBlocks(tree: Parser.Tree): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let position = 0;

  function traverse(node: Parser.SyntaxNode) {
    const blockType = getBlockType(node);
    if (blockType) {
      const name = extractBlockName(node);
      const contentHash = createContentHash(node);
      const signature = createBlockSignature(node);
      const dependencies = extractDependencies(node);

      blocks.push({
        id: `${blockType}:${name}:${contentHash}`,
        type: blockType,
        name,
        node,
        contentHash,
        dependencies,
        originalPosition: position++,
        signature,
        isModified: false,
      });

      // Continue traversing children for classes to find methods
      if (blockType === "class") {
        for (const child of node.children) {
          traverse(child);
        }
      }
      // Don't traverse children for other block types
      return;
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree.rootNode);
  return blocks;
}

function getBlockType(node: Parser.SyntaxNode): CodeBlock["type"] | null {
  const typeMap: Record<string, CodeBlock["type"]> = {
    function_declaration: "function",
    method_definition: "function",
    arrow_function: "function",
    class_declaration: "class",
    interface_declaration: "interface",
    variable_declaration: "const",
    lexical_declaration: "const",
    import_statement: "import",
    import_declaration: "import",
    export_statement: "export",
    export_declaration: "export",
  };

  return typeMap[node.type] || null;
}

function extractBlockName(node: Parser.SyntaxNode): string {
  // Try to find the name in various ways
  const nameNode =
    node.childForFieldName("name") ||
    node.children.find((child) => child.type === "identifier") ||
    node.children.find((child) => child.type === "property_identifier");

  if (nameNode) {
    return nameNode.text;
  }

  // For variable declarations, look for the first identifier
  if (
    node.type === "variable_declaration" ||
    node.type === "lexical_declaration"
  ) {
    const declarator = node.children.find(
      (child) => child.type === "variable_declarator",
    );
    if (declarator) {
      const id = declarator.childForFieldName("name");
      if (id) return id.text;
    }
  }

  // For imports/exports, extract the module or first import
  if (node.type.includes("import") || node.type.includes("export")) {
    const source = node.childForFieldName("source");
    if (source) {
      return source.text.replace(/['"]/g, "");
    }
  }

  return `unnamed_${node.type}`;
}

function createBlockSignature(node: Parser.SyntaxNode): string {
  // Create a normalized signature for matching
  const type = node.type;
  const name = extractBlockName(node);

  // For functions, include parameter types
  if (type.includes("function") || type === "method_definition") {
    const params = extractParameters(node);
    return `${type}:${name}(${params.join(",")})`;
  }

  // For classes, include extends/implements
  if (type === "class_declaration") {
    const heritage = extractClassHeritage(node);
    return `${type}:${name}${heritage ? `:${heritage}` : ""}`;
  }

  return `${type}:${name}`;
}

function extractParameters(node: Parser.SyntaxNode): string[] {
  const params: string[] = [];
  const paramsNode = node.childForFieldName("parameters");

  if (paramsNode) {
    for (const child of paramsNode.children) {
      if (child.type === "identifier" || child.type === "parameter") {
        params.push(child.text);
      }
    }
  }

  return params;
}

function extractClassHeritage(node: Parser.SyntaxNode): string {
  const heritage: string[] = [];

  for (const child of node.children) {
    if (child.type === "class_heritage") {
      heritage.push(child.text);
    }
  }

  return heritage.join(",");
}

function extractDependencies(node: Parser.SyntaxNode): string[] {
  const dependencies: string[] = [];

  function findIdentifiers(node: Parser.SyntaxNode) {
    if (node.type === "identifier" || node.type === "property_identifier") {
      dependencies.push(node.text);
    }

    for (const child of node.children) {
      findIdentifiers(child);
    }
  }

  findIdentifiers(node);
  return [...new Set(dependencies)]; // Remove duplicates
}

/**
 * Detect if blocks have been reordered
 */
function detectReordering(
  oldBlocks: CodeBlock[],
  newBlocks: CodeBlock[],
  config: ReorderConfig,
): {
  hasReordering: boolean;
  confidence: number;
  pattern: ReorderingPattern;
  matches: Array<{
    oldBlock: CodeBlock;
    newBlock: CodeBlock;
    similarity: number;
  }>;
} {
  if (
    oldBlocks.length < config.minBlocksForReorderDetection ||
    newBlocks.length < config.minBlocksForReorderDetection
  ) {
    return {
      hasReordering: false,
      confidence: 0,
      pattern: { type: "custom", confidence: 0, evidence: [] },
      matches: [],
    };
  }

  // Find content-based matches
  const matches = findContentMatches(oldBlocks, newBlocks, config);

  if (matches.length < 2) {
    return {
      hasReordering: false,
      confidence: 0,
      pattern: { type: "custom", confidence: 0, evidence: [] },
      matches: [],
    };
  }

  // Check if positions have changed significantly
  let positionChanges = 0;
  let totalMatches = 0;

  for (const match of matches) {
    const oldPos = match.oldBlock.originalPosition;
    const newPos = newBlocks.indexOf(match.newBlock);
    const positionChange = Math.abs(oldPos - newPos) / oldBlocks.length;

    if (positionChange > config.positionToleranceRatio) {
      positionChanges++;
    }
    totalMatches++;
  }

  const reorderRatio = positionChanges / totalMatches;
  const hasReordering = reorderRatio > 0.3; // 30% of blocks moved significantly

  // Detect reordering pattern
  const pattern = detectReorderingPattern(matches, oldBlocks, newBlocks);

  return {
    hasReordering,
    confidence: reorderRatio,
    pattern,
    matches,
  };
}

function findContentMatches(
  oldBlocks: CodeBlock[],
  newBlocks: CodeBlock[],
  config: ReorderConfig,
): Array<{ oldBlock: CodeBlock; newBlock: CodeBlock; similarity: number }> {
  const matches: Array<{
    oldBlock: CodeBlock;
    newBlock: CodeBlock;
    similarity: number;
  }> = [];
  const usedNewIndices = new Set<number>();

  // First pass: exact content hash matches
  for (const oldBlock of oldBlocks) {
    for (let i = 0; i < newBlocks.length; i++) {
      if (usedNewIndices.has(i)) continue;

      const newBlock = newBlocks[i];
      if (
        oldBlock.contentHash === newBlock.contentHash &&
        oldBlock.signature === newBlock.signature
      ) {
        matches.push({ oldBlock, newBlock, similarity: 1.0 });
        usedNewIndices.add(i);
        break;
      }
    }
  }

  // Second pass: high similarity matches
  for (const oldBlock of oldBlocks) {
    if (matches.some((m) => m.oldBlock === oldBlock)) continue;

    let bestMatch = -1;
    let bestSimilarity = 0;

    for (let i = 0; i < newBlocks.length; i++) {
      if (usedNewIndices.has(i)) continue;

      const newBlock = newBlocks[i];
      const similarity = calculateBlockSimilarity(oldBlock, newBlock);

      if (
        similarity > bestSimilarity &&
        similarity >= config.contentSimilarityThreshold
      ) {
        bestSimilarity = similarity;
        bestMatch = i;
      }
    }

    if (bestMatch >= 0) {
      const newBlock = newBlocks[bestMatch];
      matches.push({ oldBlock, newBlock, similarity: bestSimilarity });
      usedNewIndices.add(bestMatch);

      // Mark as modified if not exact match
      if (bestSimilarity < 1.0) {
        newBlock.isModified = true;
        newBlock.modificationDetails = {
          type: "modified",
          oldContent: oldBlock.node.text,
          newContent: newBlock.node.text,
          confidence: bestSimilarity,
        };
      }
    }
  }

  return matches;
}

function calculateBlockSimilarity(
  oldBlock: CodeBlock,
  newBlock: CodeBlock,
): number {
  // Must be same type and name for high similarity
  if (oldBlock.type !== newBlock.type || oldBlock.name !== newBlock.name) {
    return 0;
  }

  // Compare signatures
  const signatureSimilarity =
    oldBlock.signature === newBlock.signature ? 1.0 : 0.8;

  // Compare content
  const oldContent = oldBlock.node.text;
  const newContent = newBlock.node.text;
  const contentDistance = distance(oldContent, newContent);
  const maxLength = Math.max(oldContent.length, newContent.length);
  const contentSimilarity = 1 - contentDistance / maxLength;

  return signatureSimilarity * 0.3 + contentSimilarity * 0.7;
}

function detectReorderingPattern(
  matches: Array<{
    oldBlock: CodeBlock;
    newBlock: CodeBlock;
    similarity: number;
  }>,
  oldBlocks: CodeBlock[],
  newBlocks: CodeBlock[],
): ReorderingPattern {
  const evidence: string[] = [];
  let patternType: ReorderingPattern["type"] = "custom";
  let confidence = 0;

  // Check for alphabetical ordering
  const newBlockNames = newBlocks.map((block) => block.name);
  const sortedNames = [...newBlockNames].sort();
  const isAlphabetical =
    JSON.stringify(newBlockNames) === JSON.stringify(sortedNames);

  if (isAlphabetical) {
    patternType = "alphabetical";
    confidence += 0.4;
    evidence.push("Functions ordered alphabetically");
  }

  // Check for dependency-based ordering
  if (matches.length > 2) {
    const dependencyScore = analyzeDependencyOrdering(matches, newBlocks);
    if (dependencyScore > 0.6) {
      patternType = "dependency";
      confidence += 0.5;
      evidence.push("Functions ordered by dependencies");
    }
  }

  // Check for size-based ordering
  const sizesAscending = newBlocks.every(
    (block, i) =>
      i === 0 || block.node.text.length >= newBlocks[i - 1].node.text.length,
  );
  const sizesDescending = newBlocks.every(
    (block, i) =>
      i === 0 || block.node.text.length <= newBlocks[i - 1].node.text.length,
  );

  if (sizesAscending || sizesDescending) {
    patternType = "size_based";
    confidence += 0.3;
    evidence.push(
      `Functions ordered by size (${sizesAscending ? "ascending" : "descending"})`,
    );
  }

  // Check for functional grouping
  const groupingScore = analyzeFunctionalGrouping(newBlocks);
  if (groupingScore > 0.5) {
    patternType = "functional_grouping";
    confidence += 0.4;
    evidence.push("Functions grouped by functionality");
  }

  return {
    type: patternType,
    confidence: Math.min(confidence, 1.0),
    evidence,
  };
}

function analyzeDependencyOrdering(
  matches: Array<{
    oldBlock: CodeBlock;
    newBlock: CodeBlock;
    similarity: number;
  }>,
  newBlocks: CodeBlock[],
): number {
  let correctOrderings = 0;
  let totalPairs = 0;

  for (let i = 0; i < newBlocks.length - 1; i++) {
    for (let j = i + 1; j < newBlocks.length; j++) {
      const blockA = newBlocks[i];
      const blockB = newBlocks[j];

      // Check if blockB depends on blockA
      if (blockB.dependencies.includes(blockA.name)) {
        correctOrderings++;
      }
      totalPairs++;
    }
  }

  return totalPairs > 0 ? correctOrderings / totalPairs : 0;
}

function analyzeFunctionalGrouping(blocks: CodeBlock[]): number {
  // Simple heuristic: functions with similar names should be grouped
  let groupedCorrectly = 0;
  let totalChecks = 0;

  for (let i = 0; i < blocks.length - 1; i++) {
    const currentName = blocks[i].name;
    const nextName = blocks[i + 1].name;

    // Check if names have common prefixes/suffixes
    const commonPrefix = getCommonPrefix(currentName, nextName);
    const commonSuffix = getCommonSuffix(currentName, nextName);

    if (commonPrefix.length > 2 || commonSuffix.length > 2) {
      groupedCorrectly++;
    }
    totalChecks++;
  }

  return totalChecks > 0 ? groupedCorrectly / totalChecks : 0;
}

function getCommonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return a.substring(0, i);
}

function getCommonSuffix(a: string, b: string): string {
  let i = 0;
  while (
    i < a.length &&
    i < b.length &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) {
    i++;
  }
  return a.substring(a.length - i);
}

/**
 * Handle reordered lazy blocks intelligently
 */
function processReorderedLazyBlocks(
  newLazyFile: string,
  matches: Array<{
    oldBlock: CodeBlock;
    newBlock: CodeBlock;
    similarity: number;
  }>,
  pattern: ReorderingPattern,
): string {
  // Replace position-based lazy comments with semantic ones
  let processedFile = newLazyFile;

  // Pattern-specific lazy block processing
  switch (pattern.type) {
    case "alphabetical":
      processedFile = processedFile.replace(
        /\/\/ \.{3} existing code \.{3}/g,
        "// ... existing functions (alphabetically ordered) ...",
      );
      break;

    case "dependency":
      processedFile = processedFile.replace(
        /\/\/ \.{3} existing code \.{3}/g,
        "// ... existing functions (dependency ordered) ...",
      );
      break;

    case "functional_grouping":
      processedFile = processedFile.replace(
        /\/\/ \.{3} existing code \.{3}/g,
        "// ... existing functions (grouped by functionality) ...",
      );
      break;

    default:
      processedFile = processedFile.replace(
        /\/\/ \.{3} existing code \.{3}/g,
        "// ... existing functions (reordered) ...",
      );
  }

  return processedFile;
}

/**
 * Reconstruct file with correct ordering
 */
function reconstructReorderedFile(
  oldFile: string,
  newLazyFile: string,
  matches: Array<{
    oldBlock: CodeBlock;
    newBlock: CodeBlock;
    similarity: number;
  }>,
  oldBlocks: CodeBlock[],
  newBlocks: CodeBlock[],
  pattern: ReorderingPattern,
): string {
  const oldLines = oldFile.split("\n");
  const result: string[] = [];

  // Handle imports/exports first (usually stay at top)
  const imports = oldBlocks.filter((block) => block.type === "import");
  const exports = oldBlocks.filter((block) => block.type === "export");

  for (const importBlock of imports) {
    const startLine = importBlock.node.startPosition.row;
    const endLine = importBlock.node.endPosition.row;
    result.push(...oldLines.slice(startLine, endLine + 1));
  }

  if (imports.length > 0) {
    result.push(""); // Add spacing after imports
  }

  // Process reordered blocks according to new order
  for (const newBlock of newBlocks) {
    if (["import", "export"].includes(newBlock.type)) {
      continue; // Already handled
    }

    const match = matches.find((m) => m.newBlock === newBlock);
    if (match) {
      if (match.newBlock.isModified && match.newBlock.modificationDetails) {
        // Use modified content
        result.push(
          match.newBlock.modificationDetails.newContent ||
            match.oldBlock.node.text,
        );
      } else {
        // Use original content
        result.push(match.oldBlock.node.text);
      }
    } else {
      // New block, use as-is
      result.push(newBlock.node.text);
    }

    result.push(""); // Add spacing between blocks
  }

  // Handle exports at the end
  for (const exportBlock of exports) {
    const startLine = exportBlock.node.startPosition.row;
    const endLine = exportBlock.node.endPosition.row;
    result.push(...oldLines.slice(startLine, endLine + 1));
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n"); // Clean up excessive newlines
}

/**
 * Main reorder-aware lazy edit function
 */
export async function reorderAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableReorderOptimizations = true,
  reorderConfig = DEFAULT_REORDER_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableReorderOptimizations?: boolean;
  reorderConfig?: ReorderConfig;
}): Promise<DiffLine[] | undefined> {
  if (!enableReorderOptimizations || !reorderConfig.enableReorderDetection) {
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  }

  try {
    const { getParserForFile } = await import("../../../util/treeSitter");
    const parser = await getParserForFile(filename);
    if (!parser) {
      return deterministicApplyLazyEdit({
        oldFile,
        newLazyFile: newLazyFile,
        filename,
      });
    }

    const oldTree = parser.parse(oldFile);
    const newTree = parser.parse(newLazyFile);

    const oldBlocks = extractCodeBlocks(oldTree);
    const newBlocks = extractCodeBlocks(newTree);

    console.debug(
      `Extracted ${oldBlocks.length} old blocks, ${newBlocks.length} new blocks`,
    );

    // Detect reordering
    const reorderAnalysis = detectReordering(
      oldBlocks,
      newBlocks,
      reorderConfig,
    );

    if (!reorderAnalysis.hasReordering) {
      console.debug("No reordering detected, using standard approach");
      return deterministicApplyLazyEdit({
        oldFile,
        newLazyFile: newLazyFile,
        filename,
      });
    }

    console.debug(
      `Reordering detected: ${reorderAnalysis.pattern.type} (confidence: ${reorderAnalysis.confidence.toFixed(2)})`,
    );
    console.debug(`Evidence: ${reorderAnalysis.pattern.evidence.join(", ")}`);

    // Process reordered lazy blocks
    const processedLazyFile = processReorderedLazyBlocks(
      newLazyFile,
      reorderAnalysis.matches,
      reorderAnalysis.pattern,
    );

    // Reconstruct the file with correct ordering
    const reconstructedFile = reconstructReorderedFile(
      oldFile,
      processedLazyFile,
      reorderAnalysis.matches,
      oldBlocks,
      newBlocks,
      reorderAnalysis.pattern,
    );

    // Generate diff
    const { myersDiff } = await import("../../../diff/myers");
    const diff = myersDiff(oldFile, reconstructedFile);

    // Validate the reordered diff
    const validation = validateReorderedDiff(
      diff,
      oldFile,
      reconstructedFile,
      reorderAnalysis,
    );

    if (validation.isAcceptable) {
      return diff;
    } else {
      console.debug(
        "Reordered diff validation failed, falling back to standard approach",
      );
      return deterministicApplyLazyEdit({
        oldFile,
        newLazyFile: newLazyFile,
        filename,
      });
    }
  } catch (error) {
    console.debug("Reorder-aware optimization failed:", error);
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  }
}

function validateReorderedDiff(
  diff: DiffLine[],
  oldFile: string,
  newFile: string,
  reorderAnalysis: ReturnType<typeof detectReordering>,
): { isAcceptable: boolean; confidence: number; issues: string[] } {
  const issues: string[] = [];
  let confidence = reorderAnalysis.confidence;

  // Check that we have reasonable match coverage
  const matchRatio =
    reorderAnalysis.matches.length /
    Math.max(1, reorderAnalysis.matches.length);
  if (matchRatio < 0.6) {
    issues.push(`Low match coverage: ${(matchRatio * 100).toFixed(1)}%`);
    confidence -= 0.3;
  }

  // Check diff size reasonableness
  const totalLines = diff.length;
  const changeLines = diff.filter((line) => line.type !== "same").length;
  const changeRatio = changeLines / totalLines;

  if (changeRatio > 0.8) {
    issues.push(`Very high change ratio: ${(changeRatio * 100).toFixed(1)}%`);
    confidence -= 0.4;
  }

  // Check for pattern consistency
  if (reorderAnalysis.pattern.confidence < 0.3) {
    issues.push("Unclear reordering pattern");
    confidence -= 0.2;
  }

  return {
    isAcceptable: confidence >= 0.4 && issues.length < 3,
    confidence,
    issues,
  };
}
