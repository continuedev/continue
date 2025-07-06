import { distance } from "fastest-levenshtein";
import Parser from "web-tree-sitter";
import { DiffLine } from "../../..";
import { deterministicApplyLazyEdit } from "../deterministic";

// Test-specific patterns and structures
interface TestBlock {
  type:
    | "describe"
    | "test"
    | "it"
    | "beforeEach"
    | "afterEach"
    | "beforeAll"
    | "afterAll";
  name: string;
  node: Parser.SyntaxNode;
  startLine: number;
  endLine: number;
  children?: TestBlock[];
}

interface TestFileStructure {
  imports: Parser.SyntaxNode[];
  helpers: Parser.SyntaxNode[];
  testBlocks: TestBlock[];
  exports: Parser.SyntaxNode[];
}

// Enhanced test-specific similarity configuration
interface TestSimilarityConfig {
  testNameWeight: number; // 0.4 - test names are very important
  testContentWeight: number; // 0.3 - actual test logic
  structuralWeight: number; // 0.2 - describe/test structure
  assertionWeight: number; // 0.1 - assertion patterns
  minThreshold: number; // 0.5 - more lenient for tests
}

const DEFAULT_TEST_SIMILARITY_CONFIG: TestSimilarityConfig = {
  testNameWeight: 0.4,
  testContentWeight: 0.3,
  structuralWeight: 0.2,
  assertionWeight: 0.1,
  minThreshold: 0.5,
};

// Test function patterns for different frameworks
const TEST_FUNCTION_PATTERNS = {
  jest: [
    "describe",
    "test",
    "it",
    "beforeEach",
    "afterEach",
    "beforeAll",
    "afterAll",
  ],
  vitest: [
    "describe",
    "test",
    "it",
    "beforeEach",
    "afterEach",
    "beforeAll",
    "afterAll",
    "suite",
  ],
  common: ["expect", "assert", "should"],
};

// Assertion patterns to recognize test intent
const ASSERTION_PATTERNS = [
  /expect\([^)]+\)\.to/,
  /expect\([^)]+\)\.(toBe|toEqual|toContain|toMatch)/,
  /assert\.[a-zA-Z]+\(/,
  /should\.[a-zA-Z]+/,
  /chai\.expect/,
];

/**
 * Extract test file structure from AST
 */
function extractTestStructure(tree: Parser.Tree): TestFileStructure {
  const structure: TestFileStructure = {
    imports: [],
    helpers: [],
    testBlocks: [],
    exports: [],
  };

  function traverseNode(node: Parser.SyntaxNode) {
    // Handle imports
    if (
      node.type === "import_statement" ||
      node.type === "import_declaration"
    ) {
      structure.imports.push(node);
      return;
    }

    // Handle exports
    if (
      node.type === "export_statement" ||
      node.type === "export_declaration"
    ) {
      structure.exports.push(node);
      return;
    }

    // Handle test blocks
    if (node.type === "call_expression") {
      const callee = node.childForFieldName("function");
      if (callee && TEST_FUNCTION_PATTERNS.jest.includes(callee.text)) {
        const testBlock = extractTestBlock(node);
        if (testBlock) {
          structure.testBlocks.push(testBlock);
          return; // Don't traverse children as we've handled this block
        }
      }
    }

    // Handle helper functions
    if (
      node.type === "function_declaration" ||
      node.type === "arrow_function" ||
      node.type === "variable_declarator"
    ) {
      // Check if it's not inside a test block
      if (!isInsideTestBlock(node)) {
        structure.helpers.push(node);
        return;
      }
    }

    // Continue traversing children
    for (const child of node.children) {
      traverseNode(child);
    }
  }

  traverseNode(tree.rootNode);
  return structure;
}

function extractTestBlock(node: Parser.SyntaxNode): TestBlock | null {
  const callee = node.childForFieldName("function");
  if (!callee) return null;

  const type = callee.text as TestBlock["type"];
  if (!TEST_FUNCTION_PATTERNS.jest.includes(type)) return null;

  // Extract test name from first argument (usually a string)
  const args = node.childForFieldName("arguments");
  if (!args || args.children.length < 2) return null;

  const nameNode = args.children[1]; // First argument after opening paren
  let name = "";
  if (nameNode.type === "string" || nameNode.type === "template_string") {
    name = nameNode.text.slice(1, -1); // Remove quotes
  }

  const testBlock: TestBlock = {
    type,
    name,
    node,
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
    children: [],
  };

  // Extract nested test blocks for describe blocks
  if (type === "describe") {
    const body = findCallbackBody(node);
    if (body) {
      testBlock.children = extractNestedTestBlocks(body);
    }
  }

  return testBlock;
}

function extractNestedTestBlocks(bodyNode: Parser.SyntaxNode): TestBlock[] {
  const blocks: TestBlock[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === "call_expression") {
      const testBlock = extractTestBlock(node);
      if (testBlock) {
        blocks.push(testBlock);
        return; // Don't traverse children of test blocks
      }
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(bodyNode);
  return blocks;
}

function findCallbackBody(
  callNode: Parser.SyntaxNode,
): Parser.SyntaxNode | null {
  const args = callNode.childForFieldName("arguments");
  if (!args) return null;

  // Look for arrow function or function expression in arguments
  for (const child of args.children) {
    if (
      child.type === "arrow_function" ||
      child.type === "function_expression"
    ) {
      return child.childForFieldName("body");
    }
  }
  return null;
}

function isInsideTestBlock(node: Parser.SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (current.type === "call_expression") {
      const callee = current.childForFieldName("function");
      if (callee && TEST_FUNCTION_PATTERNS.jest.includes(callee.text)) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

/**
 * Calculate similarity between test blocks with test-specific weighting
 */
function calculateTestBlockSimilarity(
  a: TestBlock,
  b: TestBlock,
  config = DEFAULT_TEST_SIMILARITY_CONFIG,
): number {
  if (a.type !== b.type) return 0;

  let score = 0;

  // Test name similarity (very important for tests)
  if (a.name && b.name) {
    const nameSimilarity =
      1 - distance(a.name, b.name) / Math.max(a.name.length, b.name.length);
    score += config.testNameWeight * nameSimilarity;
  }

  // Structural similarity
  score += config.structuralWeight;

  // Content similarity (analyze test body)
  const contentSimilarity = calculateTestContentSimilarity(a.node, b.node);
  score += config.testContentWeight * contentSimilarity;

  // Assertion pattern similarity
  const assertionSimilarity = calculateAssertionSimilarity(a.node, b.node);
  score += config.assertionWeight * assertionSimilarity;

  return Math.min(score, 1.0);
}

function calculateTestContentSimilarity(
  nodeA: Parser.SyntaxNode,
  nodeB: Parser.SyntaxNode,
): number {
  const textA = nodeA.text;
  const textB = nodeB.text;

  // Quick check for identical content
  if (textA === textB) return 1.0;

  // For large test blocks, compare key sections
  const linesA = textA
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const linesB = textB
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (linesA.length === 0 || linesB.length === 0) return 0;

  // Compare line by line with partial matching
  let matchingLines = 0;
  const maxLines = Math.max(linesA.length, linesB.length);
  const minLines = Math.min(linesA.length, linesB.length);

  for (let i = 0; i < minLines; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];

    // Exact match
    if (lineA === lineB) {
      matchingLines += 1;
    }
    // Partial match for setup/assertion lines
    else if (lineA.length > 10 && lineB.length > 10) {
      const similarity =
        1 - distance(lineA, lineB) / Math.max(lineA.length, lineB.length);
      if (similarity > 0.7) {
        matchingLines += similarity;
      }
    }
  }

  return matchingLines / maxLines;
}

function calculateAssertionSimilarity(
  nodeA: Parser.SyntaxNode,
  nodeB: Parser.SyntaxNode,
): number {
  const textA = nodeA.text;
  const textB = nodeB.text;

  const assertionsA = extractAssertions(textA);
  const assertionsB = extractAssertions(textB);

  if (assertionsA.length === 0 && assertionsB.length === 0) return 1.0;
  if (assertionsA.length === 0 || assertionsB.length === 0) return 0;

  // Compare assertion patterns
  let matchingAssertions = 0;
  for (const assertionA of assertionsA) {
    for (const assertionB of assertionsB) {
      const similarity =
        1 -
        distance(assertionA, assertionB) /
          Math.max(assertionA.length, assertionB.length);
      if (similarity > 0.8) {
        matchingAssertions++;
        break;
      }
    }
  }

  return matchingAssertions / Math.max(assertionsA.length, assertionsB.length);
}

function extractAssertions(text: string): string[] {
  const assertions: string[] = [];

  for (const pattern of ASSERTION_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, "g"));
    if (matches) {
      assertions.push(...matches);
    }
  }

  return assertions;
}

/**
 * Smart test block matching that understands test insertion patterns
 */
function findBestTestBlockMatch(
  newBlock: TestBlock,
  oldBlocks: TestBlock[],
  config = DEFAULT_TEST_SIMILARITY_CONFIG,
): {
  block: TestBlock;
  similarity: number;
  insertionHint?: "before" | "after";
} | null {
  let bestMatch = null;
  let bestSimilarity = 0;
  let insertionHint: "before" | "after" | undefined;

  for (const oldBlock of oldBlocks) {
    const similarity = calculateTestBlockSimilarity(newBlock, oldBlock, config);

    if (similarity > bestSimilarity && similarity >= config.minThreshold) {
      bestSimilarity = similarity;
      bestMatch = oldBlock;

      // Determine insertion hint based on test names
      if (similarity < 0.9 && newBlock.name && oldBlock.name) {
        // Check if this looks like a new test being added near an existing one
        const nameDistance = distance(newBlock.name, oldBlock.name);
        if (nameDistance > 5) {
          // Different enough to be a new test
          insertionHint =
            newBlock.name.localeCompare(oldBlock.name) > 0 ? "after" : "before";
        }
      }
    }
  }

  return bestMatch
    ? { block: bestMatch, similarity: bestSimilarity, insertionHint }
    : null;
}

/**
 * Detect common test editing patterns
 */
enum TestEditPattern {
  ADD_NEW_TEST = "add_new_test",
  MODIFY_EXISTING_TEST = "modify_existing_test",
  ADD_DESCRIBE_BLOCK = "add_describe_block",
  MODIFY_SETUP_TEARDOWN = "modify_setup_teardown",
  UPDATE_IMPORTS = "update_imports",
  ADD_HELPER_FUNCTION = "add_helper_function",
}

function detectTestEditPattern(
  oldStructure: TestFileStructure,
  newStructure: TestFileStructure,
): TestEditPattern[] {
  const patterns: TestEditPattern[] = [];

  // Check for new test blocks
  const oldTestNames = new Set(oldStructure.testBlocks.map((b) => b.name));
  const newTestNames = new Set(newStructure.testBlocks.map((b) => b.name));

  for (const newName of newTestNames) {
    if (!oldTestNames.has(newName)) {
      patterns.push(TestEditPattern.ADD_NEW_TEST);
      break;
    }
  }

  // Check for modified imports
  if (oldStructure.imports.length !== newStructure.imports.length) {
    patterns.push(TestEditPattern.UPDATE_IMPORTS);
  }

  // Check for new helper functions
  if (oldStructure.helpers.length < newStructure.helpers.length) {
    patterns.push(TestEditPattern.ADD_HELPER_FUNCTION);
  }

  // Check for setup/teardown modifications
  const oldSetupTeardown = oldStructure.testBlocks.filter((b) =>
    ["beforeEach", "afterEach", "beforeAll", "afterAll"].includes(b.type),
  );
  const newSetupTeardown = newStructure.testBlocks.filter((b) =>
    ["beforeEach", "afterEach", "beforeAll", "afterAll"].includes(b.type),
  );

  if (oldSetupTeardown.length !== newSetupTeardown.length) {
    patterns.push(TestEditPattern.MODIFY_SETUP_TEARDOWN);
  }

  return patterns;
}

/**
 * Test-aware lazy edit optimization
 */
export async function testAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableTestOptimizations = true,
  testSimilarityConfig = DEFAULT_TEST_SIMILARITY_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableTestOptimizations?: boolean;
  testSimilarityConfig?: TestSimilarityConfig;
}): Promise<DiffLine[] | undefined> {
  // Check if this is a test file
  const isTestFile =
    /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(filename) ||
    filename.includes("__tests__") ||
    /vitest|jest/.test(oldFile) ||
    /describe\s*\(|test\s*\(|it\s*\(/.test(oldFile);

  if (!isTestFile || !enableTestOptimizations) {
    // Fall back to standard lazy edit
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  }

  try {
    // Check if this is a complete file rewrite (no lazy blocks)
    const hasLazyBlocks = /\.{3}\s*(.+?)\s*\.{3}/.test(newLazyFile);

    if (!hasLazyBlocks) {
      // This is a complete file rewrite - handle it properly
      return deterministicApplyLazyEdit({
        oldFile,
        newLazyFile: newLazyFile,
        filename,
        onlyFullFileRewrite: true,
      });
    }

    // Parse both files to understand test structure for lazy block processing
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

    const oldStructure = extractTestStructure(oldTree);
    const newStructure = extractTestStructure(newTree);

    // Detect editing patterns
    const patterns = detectTestEditPattern(oldStructure, newStructure);
    console.debug(`Detected test edit patterns: ${patterns.join(", ")}`);

    // Try pattern-specific strategies first, but always fall back to standard approach
    let result: DiffLine[] | undefined;

    if (patterns.includes(TestEditPattern.ADD_NEW_TEST)) {
      result = await handleAddNewTestPattern(
        oldFile,
        newLazyFile,
        oldStructure,
        newStructure,
        testSimilarityConfig,
      );
      if (result) return result;
    }

    if (patterns.includes(TestEditPattern.MODIFY_SETUP_TEARDOWN)) {
      result = await handleSetupTeardownPattern(
        oldFile,
        newLazyFile,
        oldStructure,
        newStructure,
      );
      if (result) return result;
    }

    // Always fall back to enhanced similarity matching or standard approach
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  } catch (error) {
    console.debug(
      "Test-aware optimization failed, falling back to standard approach:",
      error,
    );
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  }
}

async function handleAddNewTestPattern(
  oldFile: string,
  newLazyFile: string,
  oldStructure: TestFileStructure,
  newStructure: TestFileStructure,
  config: TestSimilarityConfig,
): Promise<DiffLine[] | undefined> {
  // Find new test blocks
  const oldTestNames = new Set(
    oldStructure.testBlocks.map((b) => `${b.type}:${b.name}`),
  );
  const newTests = newStructure.testBlocks.filter(
    (b) => !oldTestNames.has(`${b.type}:${b.name}`),
  );

  // For each new test, find the best insertion point
  let reconstructedFile = oldFile;

  for (const newTest of newTests) {
    const match = findBestTestBlockMatch(
      newTest,
      oldStructure.testBlocks,
      config,
    );

    if (match && match.insertionHint) {
      const targetLine =
        match.insertionHint === "after"
          ? match.block.endLine + 1
          : match.block.startLine;

      // Insert the new test at the appropriate location
      const lines = reconstructedFile.split("\n");
      const testCode = extractTestCode(newTest.node);
      lines.splice(targetLine, 0, testCode);
      reconstructedFile = lines.join("\n");
    }
  }

  // Return the diff using deterministic approach for now
  return deterministicApplyLazyEdit({
    oldFile,
    newLazyFile: reconstructedFile,
    filename: "test.js",
  });
}

function handleSetupTeardownPattern(
  oldFile: string,
  newLazyFile: string,
  oldStructure: TestFileStructure,
  newStructure: TestFileStructure,
): Promise<DiffLine[] | undefined> {
  // Handle setup/teardown changes with special care
  // These often affect multiple tests and should be treated carefully

  const { myersDiff } = require("../../diff/myers");
  return Promise.resolve(myersDiff(oldFile, newLazyFile));
}

function extractTestCode(node: Parser.SyntaxNode): string {
  // Extract the full test code with proper indentation
  const lines = node.text.split("\n");

  // Determine base indentation from first line
  const firstLine = lines[0];
  const baseIndent = firstLine.match(/^\s*/)?.[0] || "";

  // Apply consistent indentation
  return lines
    .map((line) => {
      if (line.trim() === "") return line;
      return baseIndent + line.trimStart();
    })
    .join("\n");
}

/**
 * Test-specific lazy comment handling
 */
export function createTestLazyComments(
  testType: "jest" | "vitest" = "jest",
): string[] {
  return [
    "// ... existing tests ...",
    "/* ... existing tests ... */",
    "// ... setup code ...",
    "// ... helper functions ...",
    "// ... additional test cases ...",
    "// ... teardown code ...",
  ];
}

/**
 * Validate test file diff quality with test-specific metrics
 */
export function validateTestFileDiff(
  diff: DiffLine[],
  oldContent: string,
  newContent: string,
): {
  isValid: boolean;
  confidence: number;
  issues: string[];
} {
  const issues: string[] = [];
  let confidence = 1.0;

  // Check for broken test structure
  const newTestCount = (newContent.match(/test\s*\(|it\s*\(/g) || []).length;
  const oldTestCount = (oldContent.match(/test\s*\(|it\s*\(/g) || []).length;

  if (newTestCount === 0 && oldTestCount > 0) {
    issues.push("All tests appear to have been removed");
    confidence -= 0.8;
  }

  // Check for unmatched braces (common in test files)
  const braceBalance =
    (newContent.match(/{/g) || []).length -
    (newContent.match(/}/g) || []).length;
  if (Math.abs(braceBalance) > 2) {
    issues.push("Significant brace mismatch detected");
    confidence -= 0.4;
  }

  // Check for broken async/await patterns
  const asyncTests = newContent.match(/test\s*\(\s*[^,]+,\s*async/g) || [];
  const awaitCount = (newContent.match(/await\s+/g) || []).length;

  if (asyncTests.length > 0 && awaitCount === 0) {
    issues.push("Async tests without await statements");
    confidence -= 0.2;
  }

  return {
    isValid: confidence > 0.3,
    confidence,
    issues,
  };
}
