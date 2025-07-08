import { distance } from "fastest-levenshtein";
import Parser from "web-tree-sitter";
import { DiffLine } from "../../..";
import { deterministicApplyLazyEdit } from "../deterministicLazyEdit";

/**
 * Optimizations for matching functions with similar structure but different implementations
 * Common in calculators, utilities, CRUD operations, etc.
 */

interface FunctionSignature {
  name: string;
  parameters: string[];
  returnType?: string;
  modifiers: string[];
}

interface FunctionFingerprint {
  signature: FunctionSignature;
  uniqueIdentifiers: string[]; // Variable names, method calls unique to this function
  uniqueStrings: string[]; // String literals unique to this function
  uniqueNumbers: string[]; // Numeric literals unique to this function
  operationPattern: string; // Core operation pattern (e.g., "a + b", "a * b")
  complexityScore: number; // Relative complexity
  position: number; // Position in class/file
  contextHints: string[]; // Surrounding context clues
}

interface SimilarFunctionConfig {
  signatureWeight: number; // 0.4 - Function name/params are critical
  uniqueContentWeight: number; // 0.3 - Unique identifiers/strings
  operationWeight: number; // 0.2 - Core operation logic
  positionWeight: number; // 0.1 - Relative position
  minThreshold: number; // 0.7 - Higher threshold for similar functions
}

const DEFAULT_SIMILAR_FUNCTION_CONFIG: SimilarFunctionConfig = {
  signatureWeight: 0.4,
  uniqueContentWeight: 0.3,
  operationWeight: 0.2,
  positionWeight: 0.1,
  minThreshold: 0.7,
};

/**
 * Extract function signature from AST node - Enhanced with missing node types
 */
function extractFunctionSignature(
  node: Parser.SyntaxNode,
): FunctionSignature | null {
  // Enhanced node types list including the missing ones we discovered
  const validNodeTypes = [
    "function_declaration",
    "function_definition",
    "method_definition",
    "method_declaration",
    "arrow_function",
    "function_item",
    "function_expression",
    "generator_function_declaration",
  ];

  if (!validNodeTypes.includes(node.type)) {
    return null;
  }

  let name = "";
  let parameters: string[] = [];
  let returnType = "";
  let modifiers: string[] = [];

  // Enhanced function name extraction with arrow function support
  let nameNode =
    node.childForFieldName("name") ||
    node.children.find((child) => child.type === "identifier") ||
    node.children.find((child) => child.type === "property_identifier");

  // Special handling for arrow functions in object properties
  if (!nameNode && node.type === "arrow_function") {
    let parentNode = node.parent;
    while (parentNode) {
      if (parentNode.type === "pair") {
        // Find property_identifier in the pair
        for (const child of parentNode.children) {
          if (child.type === "property_identifier") {
            nameNode = child;
            break;
          }
        }
        break;
      } else if (parentNode.type === "variable_declarator") {
        // For const name = () => ... patterns
        for (const child of parentNode.children) {
          if (child.type === "identifier") {
            nameNode = child;
            break;
          }
        }
        break;
      }
      parentNode = parentNode.parent;
    }
  }

  if (nameNode) {
    name = nameNode.text;
  }

  // Extract parameters
  const paramsNode =
    node.childForFieldName("parameters") ||
    node.children.find((child) => child.type === "formal_parameters");

  if (paramsNode) {
    parameters = paramsNode.children
      .filter(
        (child) => child.type === "identifier" || child.type === "parameter",
      )
      .map((child) => child.text);
  }

  // Extract modifiers (async, static, etc.)
  for (const child of node.children) {
    if (
      ["async", "static", "private", "public", "protected"].includes(child.type)
    ) {
      modifiers.push(child.text);
    }
  }

  // Extract return type (TypeScript)
  const returnTypeNode = node.childForFieldName("return_type");
  if (returnTypeNode) {
    returnType = returnTypeNode.text;
  }

  return { name, parameters, returnType, modifiers };
}

/**
 * Create a fingerprint that captures unique aspects of a function
 */
function createFunctionFingerprint(
  node: Parser.SyntaxNode,
  allFunctions: Parser.SyntaxNode[],
  position: number,
): FunctionFingerprint | null {
  const signature = extractFunctionSignature(node);
  if (!signature) return null;

  const functionText = node.text;
  const lines = functionText.split("\n");

  // Extract unique identifiers (variables, method calls)
  const identifiers = extractIdentifiers(node);
  const uniqueIdentifiers = findUniqueElements(
    identifiers,
    allFunctions,
    extractIdentifiers,
  );

  // Extract unique string literals
  const strings = extractStringLiterals(node);
  const uniqueStrings = findUniqueElements(
    strings,
    allFunctions,
    extractStringLiterals,
  );

  // Extract unique numeric literals
  const numbers = extractNumericLiterals(node);
  const uniqueNumbers = findUniqueElements(
    numbers,
    allFunctions,
    extractNumericLiterals,
  );

  // Extract core operation pattern
  const operationPattern = extractOperationPattern(node);

  // Calculate complexity score
  const complexityScore = calculateComplexityScore(node);

  // Extract context hints from surrounding code
  const contextHints = extractContextHints(node);

  return {
    signature,
    uniqueIdentifiers,
    uniqueStrings,
    uniqueNumbers,
    operationPattern,
    complexityScore,
    position,
    contextHints,
  };
}

function extractIdentifiers(node: Parser.SyntaxNode): string[] {
  const identifiers: string[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === "identifier" || node.type === "property_identifier") {
      identifiers.push(node.text);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(node);
  return [...new Set(identifiers)]; // Remove duplicates
}

function extractStringLiterals(node: Parser.SyntaxNode): string[] {
  const strings: string[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === "string" || node.type === "template_string") {
      strings.push(node.text);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(node);
  return strings;
}

function extractNumericLiterals(node: Parser.SyntaxNode): string[] {
  const numbers: string[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === "number") {
      numbers.push(node.text);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(node);
  return numbers;
}

function extractOperationPattern(node: Parser.SyntaxNode): string {
  const text = node.text;

  // Look for common operation patterns
  const operationPatterns = [
    /[a-zA-Z_]\w*\s*[+\-*/]\s*[a-zA-Z_]\w*/g, // a + b, x * y
    /Math\.\w+\([^)]+\)/g, // Math.pow(a, b)
    /[a-zA-Z_]\w*\.\w+\([^)]*\)/g, // obj.method()
    /[a-zA-Z_]\w*\s*[<>=!]+\s*[a-zA-Z_]\w*/g, // a == b, x > y
    /return\s+[^;]+/g, // return statements
  ];

  const patterns: string[] = [];
  for (const pattern of operationPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      patterns.push(...matches);
    }
  }

  // Return most distinctive pattern
  return patterns.length > 0 ? patterns[0] : "";
}

function calculateComplexityScore(node: Parser.SyntaxNode): number {
  let score = 0;

  function traverse(node: Parser.SyntaxNode) {
    // Add points for control flow
    if (
      [
        "if_statement",
        "for_statement",
        "while_statement",
        "switch_statement",
      ].includes(node.type)
    ) {
      score += 2;
    }

    // Add points for function calls
    if (node.type === "call_expression") {
      score += 1;
    }

    // Add points for operators
    if (["binary_expression", "unary_expression"].includes(node.type)) {
      score += 0.5;
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(node);
  return score;
}

function extractContextHints(node: Parser.SyntaxNode): string[] {
  const hints: string[] = [];

  // Look at preceding sibling for context
  let prevSibling = node.previousSibling;
  while (prevSibling && hints.length < 3) {
    if (prevSibling.type.includes("comment")) {
      hints.push(`comment:${prevSibling.text.trim()}`);
    } else if (
      prevSibling.type === "function_declaration" ||
      prevSibling.type === "method_definition"
    ) {
      const sig = extractFunctionSignature(prevSibling);
      if (sig) {
        hints.push(`prev_function:${sig.name}`);
      }
    }
    prevSibling = prevSibling.previousSibling;
  }

  // Look at following sibling for context
  let nextSibling = node.nextSibling;
  while (nextSibling && hints.length < 5) {
    if (
      nextSibling.type === "function_declaration" ||
      nextSibling.type === "method_definition"
    ) {
      const sig = extractFunctionSignature(nextSibling);
      if (sig) {
        hints.push(`next_function:${sig.name}`);
      }
      break; // Only need the immediate next function
    }
    nextSibling = nextSibling.nextSibling;
  }

  return hints;
}

function findUniqueElements<T>(
  elements: T[],
  allFunctions: Parser.SyntaxNode[],
  extractor: (node: Parser.SyntaxNode) => T[],
): T[] {
  const elementCounts = new Map<T, number>();

  // Count occurrences across all functions
  for (const func of allFunctions) {
    const funcElements = extractor(func);
    for (const element of funcElements) {
      elementCounts.set(element, (elementCounts.get(element) || 0) + 1);
    }
  }

  // Return elements that appear in only this function
  return elements.filter((element) => elementCounts.get(element) === 1);
}

/**
 * Calculate similarity between function fingerprints with emphasis on uniqueness
 */
function calculateFunctionSimilarity(
  a: FunctionFingerprint,
  b: FunctionFingerprint,
  config = DEFAULT_SIMILAR_FUNCTION_CONFIG,
): number {
  let score = 0;

  // Signature similarity (most important)
  const signatureSimilarity = calculateSignatureSimilarity(
    a.signature,
    b.signature,
  );
  score += config.signatureWeight * signatureSimilarity;

  // Unique content similarity
  const uniqueContentSim = calculateUniqueContentSimilarity(a, b);
  score += config.uniqueContentWeight * uniqueContentSim;

  // Operation pattern similarity
  const operationSim = calculateOperationSimilarity(
    a.operationPattern,
    b.operationPattern,
  );
  score += config.operationWeight * operationSim;

  // Position similarity (functions near each other are more likely to be similar)
  const positionSim = calculatePositionSimilarity(a.position, b.position);
  score += config.positionWeight * positionSim;

  return Math.min(score, 1.0);
}

function calculateSignatureSimilarity(
  a: FunctionSignature,
  b: FunctionSignature,
): number {
  // Exact name match is heavily weighted
  if (a.name === b.name) {
    return 1.0;
  }

  // Similar name (edit distance)
  const nameDistance = distance(a.name, b.name);
  const maxNameLength = Math.max(a.name.length, b.name.length);
  const nameSimilarity = 1 - nameDistance / maxNameLength;

  // Parameter similarity
  const paramSimilarity = calculateParameterSimilarity(
    a.parameters,
    b.parameters,
  );

  // Combined score with heavy weight on exact name matches
  return nameSimilarity * 0.8 + paramSimilarity * 0.2;
}

function calculateParameterSimilarity(a: string[], b: string[]): number {
  if (a.length !== b.length) {
    return Math.max(0, 1 - Math.abs(a.length - b.length) * 0.2);
  }

  if (a.length === 0 && b.length === 0) return 1.0;

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) {
      matches++;
    } else {
      // Partial credit for similar parameter names
      const dist = distance(a[i], b[i]);
      const maxLen = Math.max(a[i].length, b[i].length);
      if (dist / maxLen < 0.5) {
        matches += 0.5;
      }
    }
  }

  return matches / a.length;
}

function calculateUniqueContentSimilarity(
  a: FunctionFingerprint,
  b: FunctionFingerprint,
): number {
  // Heavy penalty if unique elements don't match
  const uniqueIdScore = calculateArraySimilarity(
    a.uniqueIdentifiers,
    b.uniqueIdentifiers,
  );
  const uniqueStrScore = calculateArraySimilarity(
    a.uniqueStrings,
    b.uniqueStrings,
  );
  const uniqueNumScore = calculateArraySimilarity(
    a.uniqueNumbers,
    b.uniqueNumbers,
  );

  return uniqueIdScore * 0.5 + uniqueStrScore * 0.3 + uniqueNumScore * 0.2;
}

function calculateArraySimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

function calculateOperationSimilarity(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;

  const dist = distance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

function calculatePositionSimilarity(a: number, b: number): number {
  const distance = Math.abs(a - b);
  if (distance === 0) return 1.0;
  if (distance === 1) return 0.8;
  if (distance === 2) return 0.6;
  return Math.max(0, 1 - distance * 0.2);
}

/**
 * Detect if file contains many similar functions (calculator pattern)
 */
function detectSimilarFunctionPattern(functions: Parser.SyntaxNode[]): {
  hasSimilarFunctions: boolean;
  confidence: number;
  patterns: string[];
} {
  if (functions.length < 3) {
    return { hasSimilarFunctions: false, confidence: 0, patterns: [] };
  }

  const signatures = functions
    .map((func) => extractFunctionSignature(func))
    .filter(Boolean) as FunctionSignature[];
  const patterns: string[] = [];
  let similarityScore = 0;

  // Check for common parameter patterns
  const paramPatterns = signatures.map(
    (sig) => `${sig.parameters.length}:${sig.parameters.join(",")}`,
  );
  const uniqueParamPatterns = new Set(paramPatterns);
  if (uniqueParamPatterns.size < signatures.length * 0.7) {
    patterns.push("similar_parameters");
    similarityScore += 0.3;
  }

  // Check for common return patterns
  const functionTexts = functions.map((func) => func.text);
  const returnStatements = functionTexts.map((text) => {
    const match = text.match(/return\s+[^;]+/);
    return match ? match[0] : "";
  });

  const uniqueReturns = new Set(returnStatements.filter(Boolean));
  if (uniqueReturns.size < returnStatements.length * 0.5) {
    patterns.push("similar_returns");
    similarityScore += 0.4;
  }

  // Check for operation patterns (mathematical, logical, string manipulation, etc.)
  const hasOperations = functionTexts.some(
    (text) =>
      /[+\-*/%&|^<>=!]/.test(text) || // Mathematical, logical, comparison operators
      /Math\.\w+/.test(text) || // Math functions
      /String\.\w+/.test(text) || // String functions
      /Array\.\w+/.test(text) || // Array functions
      /Object\.\w+/.test(text) || // Object functions
      /JSON\.\w+/.test(text) || // JSON functions
      /\.map\(/.test(text) || // Array methods
      /\.filter\(/.test(text) ||
      /\.reduce\(/.test(text) ||
      /\.forEach\(/.test(text) ||
      /\.find\(/.test(text) ||
      /\.sort\(/.test(text) ||
      /\.slice\(/.test(text) ||
      /\.splice\(/.test(text) ||
      /\.push\(/.test(text) ||
      /\.pop\(/.test(text) ||
      /\.join\(/.test(text) ||
      /\.split\(/.test(text) ||
      /\.replace\(/.test(text) ||
      /\.match\(/.test(text) ||
      /\.test\(/.test(text) ||
      /\.includes\(/.test(text) ||
      /\.indexOf\(/.test(text) ||
      /\.substring\(/.test(text) ||
      /\.trim\(/.test(text) ||
      /\.toLowerCase\(/.test(text) ||
      /\.toUpperCase\(/.test(text),
  );
  if (hasOperations) {
    patterns.push("common_operations");
    similarityScore += 0.2;
  }

  // Check for method chaining patterns
  const hasChaining = functionTexts.some((text) => /return\s+this/.test(text));
  if (hasChaining) {
    patterns.push("method_chaining");
    similarityScore += 0.1;
  }

  return {
    hasSimilarFunctions: similarityScore >= 0.5,
    confidence: similarityScore,
    patterns,
  };
}

/**
 * Clean lazy file content by removing comments and extracting function definitions
 */
function cleanLazyFileContent(lazyFile: string): string {
  // Remove common lazy edit comment patterns
  let cleaned = lazyFile
    .replace(/\/\/\s*\.\.\.\s*existing\s+code\s*\.\.\./gi, "")
    .replace(/\/\*\s*\.\.\.\s*existing\s+code\s*\.\.\.\s*\*\//gi, "")
    .replace(/<!--\s*\.\.\.\s*existing\s+code\s*\.\.\.\s*-->/gi, "")
    .trim();

  // If the cleaned content looks like it might be just function definitions,
  // wrap it in a minimal class structure for parsing
  const lines = cleaned.split("\n").filter((line) => line.trim());

  // Check if all non-empty lines look like method definitions
  const methodPattern = /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*\{/;
  const allLooksLikeMethods =
    lines.length > 0 &&
    lines.every((line) => {
      const trimmed = line.trim();
      return (
        trimmed === "" ||
        trimmed === "}" ||
        methodPattern.test(trimmed) ||
        !trimmed.startsWith("//")
      );
    });

  if (allLooksLikeMethods && lines.some((line) => methodPattern.test(line))) {
    // Wrap in a minimal class for parsing
    return `class TempClass {\n${cleaned}\n}`;
  }

  return cleaned;
}

/**
 * Enhanced lazy edit for files with many similar functions
 */
export async function similarFunctionAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableSimilarFunctionOptimizations = true,
  similarFunctionConfig = DEFAULT_SIMILAR_FUNCTION_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableSimilarFunctionOptimizations?: boolean;
  similarFunctionConfig?: SimilarFunctionConfig;
}): Promise<DiffLine[] | undefined> {
  if (!enableSimilarFunctionOptimizations) {
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

    // Handle partial/lazy content in newLazyFile
    const cleanedNewFile = cleanLazyFileContent(newLazyFile);
    const newTree = parser.parse(cleanedNewFile);

    // Extract all functions from both files
    const oldFunctions = extractAllFunctions(oldTree.rootNode);
    const newFunctions = extractAllFunctions(newTree.rootNode);

    console.debug(
      `Found ${oldFunctions.length} old functions, ${newFunctions.length} new functions`,
    );

    // Check if this file has the similar function pattern
    const oldPattern = detectSimilarFunctionPattern(oldFunctions);
    const newPattern = detectSimilarFunctionPattern(newFunctions);

    if (!oldPattern.hasSimilarFunctions && !newPattern.hasSimilarFunctions) {
      // No similar function pattern detected, use standard approach
      return deterministicApplyLazyEdit({
        oldFile,
        newLazyFile: newLazyFile,
        filename,
      });
    }

    console.debug(
      `Similar function pattern detected: ${oldPattern.patterns.join(", ")} (confidence: ${oldPattern.confidence.toFixed(2)})`,
    );

    // Create function fingerprints for enhanced matching
    const oldFingerprints = oldFunctions
      .map((func, i) => createFunctionFingerprint(func, oldFunctions, i))
      .filter(Boolean) as FunctionFingerprint[];

    const newFingerprints = newFunctions
      .map((func, i) => createFunctionFingerprint(func, newFunctions, i))
      .filter(Boolean) as FunctionFingerprint[];

    // Perform enhanced function matching
    const functionMatches = performEnhancedFunctionMatching(
      oldFingerprints,
      newFingerprints,
      similarFunctionConfig,
    );

    // If we have high-confidence matches, apply them
    if (functionMatches.length > 0) {
      const reconstructedFile = applyFunctionMatches(
        oldFile,
        newLazyFile,
        functionMatches,
        oldTree,
        newTree,
      );

      if (reconstructedFile) {
        const { myersDiff } = await import("../../../diff/myers");
        const diff = myersDiff(oldFile, reconstructedFile);

        // Validate the diff quality
        const quality = validateSimilarFunctionDiff(
          diff,
          oldFile,
          reconstructedFile,
          functionMatches,
        );

        console.debug(
          `Diff validation: acceptable=${quality.isAcceptable}, confidence=${quality.confidence.toFixed(2)}`,
        );

        if (quality.isAcceptable) {
          console.debug("Similar function optimization succeeded");
          return diff;
        } else {
          console.debug("Diff validation failed, will fallback");
        }
      } else {
        console.debug("reconstructedFile is null, cannot create diff");
      }
    } else {
      console.debug("No function matches found");
    }

    // Fallback to standard approach
    console.debug(
      "Enhanced function matching failed, falling back to standard approach",
    );
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  } catch (error) {
    console.debug("Similar function optimization failed:", error);
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  }
}

function extractAllFunctions(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
  const functions: Parser.SyntaxNode[] = [];

  // Enhanced node types to match our improved signature extraction
  const functionNodeTypes = [
    "function_declaration",
    "function_definition",
    "method_definition",
    "method_declaration",
    "arrow_function",
    "function_item",
    "function_expression",
    "generator_function_declaration",
  ];

  function traverse(node: Parser.SyntaxNode) {
    if (functionNodeTypes.includes(node.type)) {
      functions.push(node);
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(node);
  return functions;
}

interface FunctionMatch {
  oldFingerprint: FunctionFingerprint;
  newFingerprint: FunctionFingerprint;
  similarity: number;
  confidence: "high" | "medium" | "low";
}

function performEnhancedFunctionMatching(
  oldFingerprints: FunctionFingerprint[],
  newFingerprints: FunctionFingerprint[],
  config: SimilarFunctionConfig,
): FunctionMatch[] {
  const matches: FunctionMatch[] = [];
  const usedOldIndices = new Set<number>();
  const usedNewIndices = new Set<number>();

  // First pass: exact name matches (highest priority)
  for (let i = 0; i < newFingerprints.length; i++) {
    if (usedNewIndices.has(i)) continue;

    for (let j = 0; j < oldFingerprints.length; j++) {
      if (usedOldIndices.has(j)) continue;

      if (
        newFingerprints[i].signature.name === oldFingerprints[j].signature.name
      ) {
        matches.push({
          oldFingerprint: oldFingerprints[j],
          newFingerprint: newFingerprints[i],
          similarity: 1.0,
          confidence: "high",
        });
        usedOldIndices.add(j);
        usedNewIndices.add(i);
        break;
      }
    }
  }

  // Second pass: high similarity matches
  for (let i = 0; i < newFingerprints.length; i++) {
    if (usedNewIndices.has(i)) continue;

    let bestMatch = -1;
    let bestSimilarity = 0;

    for (let j = 0; j < oldFingerprints.length; j++) {
      if (usedOldIndices.has(j)) continue;

      const similarity = calculateFunctionSimilarity(
        oldFingerprints[j],
        newFingerprints[i],
        config,
      );

      if (similarity > bestSimilarity && similarity >= config.minThreshold) {
        bestSimilarity = similarity;
        bestMatch = j;
      }
    }

    if (bestMatch >= 0) {
      matches.push({
        oldFingerprint: oldFingerprints[bestMatch],
        newFingerprint: newFingerprints[i],
        similarity: bestSimilarity,
        confidence:
          bestSimilarity >= 0.9
            ? "high"
            : bestSimilarity >= 0.8
              ? "medium"
              : "low",
      });
      usedOldIndices.add(bestMatch);
      usedNewIndices.add(i);
    }
  }

  return matches;
}

function applyFunctionMatches(
  oldFile: string,
  newLazyFile: string,
  matches: FunctionMatch[],
  oldTree: Parser.Tree,
  newTree: Parser.Tree,
): string | null {
  try {
    console.debug(`Applying ${matches.length} function matches`);

    // If we have high-confidence matches, apply targeted replacements
    const highConfidenceMatches = matches.filter(
      (m) => m.confidence === "high",
    );

    console.debug(`High confidence matches: ${highConfidenceMatches.length}`);

    if (highConfidenceMatches.length > 0) {
      // Log the match details
      for (const match of highConfidenceMatches) {
        console.debug(
          `Match: ${match.oldFingerprint.signature.name} → ${match.newFingerprint.signature.name} (similarity: ${match.similarity.toFixed(2)})`,
        );
      }

      // For similar function scenarios, we need to be more intelligent about replacement
      // Instead of returning the entire new file, let's do targeted function replacement
      return applyTargetedFunctionReplacements(
        oldFile,
        newLazyFile,
        highConfidenceMatches,
        oldTree,
        newTree,
      );
    }

    // If we have any matches at all, try to apply them
    if (matches.length > 0) {
      console.debug("Applying medium/low confidence matches");
      return applyTargetedFunctionReplacements(
        oldFile,
        newLazyFile,
        matches,
        oldTree,
        newTree,
      );
    }

    console.debug("No matches found, returning null");
    return null;
  } catch (error) {
    console.debug("Function match application failed:", error);
    return null;
  }
}

function applyTargetedFunctionReplacements(
  oldFile: string,
  newLazyFile: string,
  matches: FunctionMatch[],
  oldTree: Parser.Tree,
  newTree: Parser.Tree,
): string {
  // For simple cases where we're just replacing function bodies,
  // and the matches are exact name matches, we can do a more targeted approach
  const exactNameMatches = matches.filter(
    (match) =>
      match.oldFingerprint.signature.name ===
      match.newFingerprint.signature.name,
  );

  if (
    exactNameMatches.length === matches.length &&
    exactNameMatches.length <= 5
  ) {
    console.debug(
      `All matches are exact name matches (${exactNameMatches.length}), attempting targeted replacement`,
    );

    // Try targeted replacement for exact name matches
    try {
      const result = performTargetedReplacement(
        oldFile,
        newLazyFile,
        exactNameMatches,
        oldTree,
        newTree,
      );
      if (result) {
        console.debug("Targeted replacement successful");
        return result;
      }
    } catch (error) {
      console.debug("Targeted replacement failed:", error);
    }
  }

  // Fallback: return the new file content for complex scenarios
  console.debug("Using fallback approach: returning new file content");
  return newLazyFile;
}

function performTargetedReplacement(
  oldFile: string,
  newLazyFile: string,
  matches: FunctionMatch[],
  oldTree: Parser.Tree,
  newTree: Parser.Tree,
): string | null {
  const oldLines = oldFile.split("\n");

  // Find the function nodes in both trees
  const oldFunctions = extractAllFunctions(oldTree.rootNode);
  const newFunctions = extractAllFunctions(newTree.rootNode);

  // Create a mapping of function names to their AST nodes with better class method support
  const oldFunctionMap = new Map<string, Parser.SyntaxNode>();
  const newFunctionMap = new Map<string, Parser.SyntaxNode>();

  // Enhanced mapping that considers class context
  for (const func of oldFunctions) {
    const sig = extractFunctionSignature(func);
    if (sig) {
      // Create a unique key that includes class context for methods
      const key = createFunctionKey(func, sig);
      oldFunctionMap.set(key, func);
      // Also store with simple name for backward compatibility
      oldFunctionMap.set(sig.name, func);
    }
  }

  for (const func of newFunctions) {
    const sig = extractFunctionSignature(func);
    if (sig) {
      // Create a unique key that includes class context for methods
      const key = createFunctionKey(func, sig);
      newFunctionMap.set(key, func);
      // Also store with simple name for backward compatibility
      newFunctionMap.set(sig.name, func);
    }
  }

  // Apply replacements in reverse order (from end to start) to maintain line numbers
  const replacements: Array<{
    startLine: number;
    endLine: number;
    newContent: string;
    functionName: string;
  }> = [];

  for (const match of matches) {
    const functionName = match.oldFingerprint.signature.name;

    // Try to find nodes using enhanced matching
    let oldNode = oldFunctionMap.get(functionName);
    let newNode = newFunctionMap.get(functionName);

    // If not found, try to find by signature matching
    if (!oldNode || !newNode) {
      console.debug(
        `Standard lookup failed for ${functionName}, trying enhanced matching`,
      );

      // Find the best matching nodes by signature
      for (const [key, node] of oldFunctionMap.entries()) {
        const sig = extractFunctionSignature(node);
        if (sig && sig.name === functionName) {
          oldNode = node;
          break;
        }
      }

      for (const [key, node] of newFunctionMap.entries()) {
        const sig = extractFunctionSignature(node);
        if (sig && sig.name === functionName) {
          newNode = node;
          break;
        }
      }
    }

    if (!oldNode || !newNode) {
      console.debug(`Could not find nodes for function: ${functionName}`);
      console.debug(
        `Available old functions: ${Array.from(oldFunctionMap.keys()).join(", ")}`,
      );
      console.debug(
        `Available new functions: ${Array.from(newFunctionMap.keys()).join(", ")}`,
      );
      continue;
    }

    console.debug(
      `Found replacement for ${functionName}: lines ${oldNode.startPosition.row}-${oldNode.endPosition.row}`,
    );

    // Get the new function content, handling indentation properly
    let newContent = newNode.text;

    console.debug(`Raw newContent for ${functionName}:\n${newContent}`);

    // Debug: Check what's actually on those lines in the old file
    const startLine = oldNode.startPosition.row;
    const endLine = oldNode.endPosition.row;
    console.debug(`Lines ${startLine}-${endLine} in old file:`);
    for (let i = startLine; i <= endLine; i++) {
      console.debug(`  ${i}: "${oldLines[i]}"`);
    }

    // Determine the indentation level from the original old function
    const oldIndent =
      oldLines[oldNode.startPosition.row].match(/^\s*/)?.[0] || "";

    console.debug(
      `Does newContent include 'class TempClass'? ${newContent.includes("class TempClass")}`,
    );

    // If the new content appears to be from a temporary class wrapper,
    // we need to extract just the function content with proper indentation
    if (newContent.includes("class TempClass")) {
      console.debug(
        `Extracting function ${functionName} from TempClass wrapper`,
      );

      // The newNode.text will be the entire TempClass content
      // We need to find the specific function within it
      const functionLines = newContent.split("\n");

      // Find the actual function content (skip class wrapper)
      let functionStart = -1;
      for (let i = 0; i < functionLines.length; i++) {
        const line = functionLines[i].trim();
        if (line.startsWith(`${functionName}(`)) {
          functionStart = i;
          break;
        }
      }

      if (functionStart >= 0) {
        console.debug(
          `Found function ${functionName} at line ${functionStart} in wrapper`,
        );

        // Find the end of the function by matching braces
        let braceCount = 0;
        let functionEnd = functionStart;
        let foundOpenBrace = false;

        for (let i = functionStart; i < functionLines.length; i++) {
          const line = functionLines[i];
          for (const char of line) {
            if (char === "{") {
              braceCount++;
              foundOpenBrace = true;
            }
            if (char === "}") {
              braceCount--;
            }
          }
          if (foundOpenBrace && braceCount === 0) {
            functionEnd = i;
            break;
          }
        }

        // Extract the function content with proper indentation
        const extractedLines = functionLines.slice(
          functionStart,
          functionEnd + 1,
        );

        console.debug(
          `Extracted ${extractedLines.length} lines for function ${functionName}`,
        );

        // Determine the indentation level from the original old function
        const oldIndent =
          oldLines[oldNode.startPosition.row].match(/^\s*/)?.[0] || "";

        // Apply the correct indentation to extracted lines
        newContent = extractedLines
          .map((line, index) => {
            if (index === 0) {
              // First line: use the old function's indentation
              return oldIndent + line.trim();
            } else {
              // Other lines: preserve relative indentation but adjust base
              const lineIndent = line.match(/^\s*/)?.[0] || "";
              const relativeLine = line.trim();

              if (relativeLine === "") {
                // Empty lines stay empty
                return "";
              } else {
                // Since we're extracting from a wrapped class, remove one level of indentation
                // But ensure we preserve the relative structure
                let relativeIndent = "";
                if (lineIndent.length >= 2) {
                  // Remove the class wrapper indentation (2 spaces) and keep the rest
                  relativeIndent = lineIndent.substring(2);
                } else if (relativeLine !== "}") {
                  // If it's not a closing brace and has no indentation, add default function body indent
                  relativeIndent = "  ";
                }

                return oldIndent + relativeIndent + relativeLine;
              }
            }
          })
          .join("\n");

        console.debug(
          `Final extracted content for ${functionName}:\n${newContent}`,
        );
      } else {
        console.debug(
          `Could not find function ${functionName} in TempClass wrapper`,
        );
        // Fallback: use the node text as-is but still apply proper indentation
        newContent = applyIndentationToContent(newContent, oldIndent);
      }
    } else {
      // Normal case: apply proper indentation to the new content
      console.debug(
        `Applying indentation to non-TempClass content for ${functionName}`,
      );
      newContent = applyIndentationToContent(newContent, oldIndent);
    }

    replacements.push({
      startLine: oldNode.startPosition.row,
      endLine: oldNode.endPosition.row,
      newContent,
      functionName,
    });
  }

  if (replacements.length === 0) {
    console.debug("No replacements to apply");
    return null;
  }

  console.debug(`Applying ${replacements.length} replacements`);

  // Sort replacements by start line in descending order
  replacements.sort((a, b) => b.startLine - a.startLine);

  // Apply replacements
  let result = [...oldLines];
  for (const replacement of replacements) {
    console.debug(
      `Replacing ${replacement.functionName} at lines ${replacement.startLine}-${replacement.endLine}`,
    );

    const newFunctionLines = replacement.newContent.split("\n");
    const deleteCount = replacement.endLine - replacement.startLine + 1;

    console.debug(
      `About to splice: start=${replacement.startLine}, deleteCount=${deleteCount}, insertCount=${newFunctionLines.length}`,
    );
    console.debug(`New function lines: ${JSON.stringify(newFunctionLines)}`);
    console.debug(`Current result length: ${result.length}`);

    // Show what we're about to replace
    console.debug(`Lines being replaced:`);
    for (let i = replacement.startLine; i <= replacement.endLine; i++) {
      console.debug(`  ${i}: "${result[i]}"`);
    }

    // Debug: show what we're actually inserting
    console.debug(
      `Inserting these lines at position ${replacement.startLine}:`,
    );
    newFunctionLines.forEach((line, idx) => {
      console.debug(`  insert[${idx}]: "${line}"`);
    });

    result.splice(replacement.startLine, deleteCount, ...newFunctionLines);

    console.debug(`Result length after splice: ${result.length}`);

    // Debug: show the result around the replacement area
    console.debug(
      `Result after replacement (lines ${Math.max(0, replacement.startLine - 2)}-${Math.min(result.length - 1, replacement.startLine + newFunctionLines.length + 2)}):`,
    );
    for (
      let i = Math.max(0, replacement.startLine - 2);
      i <=
      Math.min(
        result.length - 1,
        replacement.startLine + newFunctionLines.length + 2,
      );
      i++
    ) {
      console.debug(`  result[${i}]: "${result[i]}"`);
    }
  }

  return result.join("\n");
}

// Helper function to apply proper indentation to function content
function applyIndentationToContent(
  content: string,
  targetIndent: string,
): string {
  const lines = content.split("\n");

  // First, normalize the content by removing all indentation
  const normalizedLines = lines.map((line) => line.trim());

  return normalizedLines
    .map((line, index) => {
      if (line === "") {
        // Empty lines stay empty
        return "";
      } else if (index === 0) {
        // First line: use the target indentation
        return targetIndent + line;
      } else if (line === "}") {
        // Closing braces get the same indentation as the opening line
        return targetIndent + line;
      } else {
        // Function body lines get target indent + 2 spaces
        return targetIndent + "  " + line;
      }
    })
    .join("\n");
}

// Helper function to create a unique key for functions that considers class context
function createFunctionKey(
  node: Parser.SyntaxNode,
  signature: FunctionSignature,
): string {
  // Check if this is a class method
  let currentNode = node.parent;
  while (currentNode) {
    if (
      currentNode.type === "class_declaration" ||
      currentNode.type === "class_definition"
    ) {
      // Find the class name
      const classNameNode =
        currentNode.childForFieldName("name") ||
        currentNode.children.find((child) => child.type === "identifier");
      if (classNameNode) {
        return `${classNameNode.text}::${signature.name}`;
      }
    }
    currentNode = currentNode.parent;
  }

  // If not a class method, just use the function name
  return signature.name;
}

function validateSimilarFunctionDiff(
  diff: DiffLine[],
  oldFile: string,
  newFile: string,
  matches: FunctionMatch[],
): { isAcceptable: boolean; confidence: number } {
  // Enhanced validation for similar function scenarios
  const highConfidenceMatches = matches.filter(
    (m) => m.confidence === "high",
  ).length;
  const totalMatches = matches.length;

  const confidence =
    totalMatches > 0 ? highConfidenceMatches / totalMatches : 0;

  // Check if we have any high-confidence matches - if so, accept it
  if (highConfidenceMatches > 0) {
    console.debug(
      `Accepting diff with ${highConfidenceMatches} high-confidence matches`,
    );
    return {
      isAcceptable: true,
      confidence: 1.0,
    };
  }

  // Check if diff looks reasonable (has both old and new lines)
  const oldLines = diff.filter((line) => line.type === "old").length;
  const newLines = diff.filter((line) => line.type === "new").length;
  const sameLines = diff.filter((line) => line.type === "same").length;

  console.debug(
    `Diff composition: ${oldLines} old, ${newLines} new, ${sameLines} same lines`,
  );

  // If we have any matches and the diff has reasonable changes, accept it
  if (totalMatches > 0 && (oldLines > 0 || newLines > 0)) {
    console.debug(
      `Accepting diff with ${totalMatches} matches and reasonable changes`,
    );
    return {
      isAcceptable: true,
      confidence: Math.max(0.5, confidence),
    };
  }

  console.debug(`Rejecting diff: insufficient matches or changes`);
  return {
    isAcceptable: false,
    confidence,
  };
}
