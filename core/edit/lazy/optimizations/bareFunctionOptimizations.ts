import { DiffLine } from "../../..";
import { deterministicApplyLazyEdit } from "../deterministicLazyEdit";

/**
 * Bare function replacement optimization
 * Handles scenarios where user provides just a function without lazy markers,
 * intending to replace a specific function in the existing file
 */
export async function bareFunctionAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableBareFunctionOptimizations = true,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableBareFunctionOptimizations?: boolean;
}): Promise<DiffLine[] | undefined> {
  if (!enableBareFunctionOptimizations) {
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
    });
  }

  try {
    // Analyze if this is a bare function replacement scenario
    const analysis = await analyzeBareFunction(oldFile, newLazyFile, filename);

    console.debug(
      "bareFunctionAwareLazyEdit analysis:",
      "isBareFunction:",
      analysis.isBareFunction,
      "functionName:",
      analysis.functionName,
      "confidence:",
      analysis.confidence,
    );

    if (!analysis.isBareFunction) {
      console.debug("Not a bare function scenario, returning undefined");
      return undefined; // Not a bare function scenario
    }

    console.debug(
      "Bare function replacement detected:",
      analysis.functionName,
      "confidence:",
      analysis.confidence,
    );

    // Apply bare function optimization
    return await applyBareFunctionReplacement(
      oldFile,
      newLazyFile,
      filename,
      analysis,
    );
  } catch (error) {
    console.debug("Bare function optimization failed:", error);
    return undefined;
  }
}

interface BareFunctionAnalysis {
  isBareFunction: boolean;
  functionName: string;
  functionType: "function" | "method" | "arrow" | "async";
  confidence: number;
  matchedFunction?: {
    name: string;
    startLine: number;
    endLine: number;
    content: string;
  };
}

async function analyzeBareFunction(
  oldFile: string,
  newLazyFile: string,
  filename: string,
): Promise<BareFunctionAnalysis> {
  const newFileContent = newLazyFile.trim();

  // Use AST to analyze the new file content
  const newFunctionInfo = await extractFunctionFromContent(
    newFileContent,
    filename,
  );

  if (!newFunctionInfo) {
    return {
      isBareFunction: false,
      functionName: "",
      functionType: "function",
      confidence: 0,
    };
  }

  // Use AST to find matching function in old file
  const matchedFunction = await findFunctionInOldFileWithAST(
    oldFile,
    newFunctionInfo.name,
    filename,
  );

  if (!matchedFunction) {
    return {
      isBareFunction: false,
      functionName: newFunctionInfo.name,
      functionType: newFunctionInfo.type,
      confidence: 0,
    };
  }

  // Calculate confidence using AST-based structural analysis
  const confidence = calculateConfidenceWithAST(
    newFileContent,
    matchedFunction,
    newFunctionInfo,
  );

  return {
    isBareFunction: confidence > 0.4, // Lowered threshold for better coverage
    functionName: newFunctionInfo.name,
    functionType: newFunctionInfo.type,
    confidence,
    matchedFunction,
  };
}

function findFunctionInOldFile(
  oldFile: string,
  functionName: string,
):
  | {
      name: string;
      startLine: number;
      endLine: number;
      content: string;
    }
  | undefined {
  const lines = oldFile.split("\n");

  // Look for function definition patterns - Updated for TypeScript
  const patterns = [
    new RegExp(`^\\s*(async\\s+)?function\\s+${functionName}\\s*\\(`),
    new RegExp(
      `^\\s*(async\\s+)?${functionName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*{`,
    ),
    new RegExp(
      `^\\s*const\\s+${functionName}\\s*=\\s*(async\\s+)?\\([^)]*\\)\\s*(?::\\s*[^=]+)?\\s*=>`,
    ),
    // Object property arrow function: functionName: (params) => expr
    new RegExp(`^\\s*${functionName}:\\s*\\([^)]*\\)\\s*(?::\\s*[^=]+)?\\s*=>`),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (patterns.some((pattern) => pattern.test(line))) {
      // Found function start, now find the end
      const startLine = i;
      let braceCount = 0;
      let inFunction = false;
      let endLine = startLine;

      for (let j = startLine; j < lines.length; j++) {
        const currentLine = lines[j];

        // Count braces to find function end
        for (const char of currentLine) {
          if (char === "{") {
            braceCount++;
            inFunction = true;
          } else if (char === "}") {
            braceCount--;
            if (inFunction && braceCount === 0) {
              endLine = j;
              const content = lines.slice(startLine, endLine + 1).join("\n");
              return {
                name: functionName,
                startLine,
                endLine,
                content,
              };
            }
          }
        }
      }
    }
  }

  return undefined;
}

async function applyBareFunctionReplacement(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  analysis: BareFunctionAnalysis,
): Promise<DiffLine[]> {
  const matchedFunction = analysis.matchedFunction!;

  // Use AST-aware approach to generate precise diff
  return await applyASTAwareFunctionReplacement(
    oldFile,
    newLazyFile.trim(),
    matchedFunction,
    filename,
  );
}

// Enhanced AST-aware function replacement with explicit old/new line generation
async function applyASTAwareFunctionReplacement(
  oldFile: string,
  newFunction: string,
  matchedFunction: {
    name: string;
    startLine: number;
    endLine: number;
    content: string;
  },
  filename: string,
): Promise<DiffLine[]> {
  const oldLines = oldFile.split("\n");
  const newFunctionLines = newFunction.split("\n");
  const result: DiffLine[] = [];

  // Add unchanged lines before the function
  for (let i = 0; i < matchedFunction.startLine; i++) {
    result.push({ type: "same", line: oldLines[i] });
  }

  // Add the old function lines as "old" type (being removed)
  for (let i = matchedFunction.startLine; i <= matchedFunction.endLine; i++) {
    result.push({ type: "old", line: oldLines[i] });
  }

  // Preserve indentation from the original function
  const originalIndent = getIndentationFromLine(
    oldLines[matchedFunction.startLine],
  );

  // Add the new function lines as "new" type (being added) with proper indentation
  for (let i = 0; i < newFunctionLines.length; i++) {
    const line = newFunctionLines[i];

    if (i === 0) {
      // First line: use the original function's indentation
      result.push({ type: "new", line: originalIndent + line.trim() });
    } else {
      // Other lines: preserve relative indentation
      const lineIndent = getIndentationFromLine(line);
      const relativeLine = line.trim();

      if (relativeLine === "") {
        // Empty lines stay empty
        result.push({ type: "new", line: "" });
      } else {
        // Apply original indentation plus relative indentation
        const relativeIndent = lineIndent.length > 0 ? lineIndent : "  "; // Default 2 spaces for body
        result.push({
          type: "new",
          line: originalIndent + relativeIndent + relativeLine,
        });
      }
    }
  }

  // Add unchanged lines after the function
  for (let i = matchedFunction.endLine + 1; i < oldLines.length; i++) {
    result.push({ type: "same", line: oldLines[i] });
  }

  return result;
}

// Helper function to extract indentation from a line
function getIndentationFromLine(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : "";
}

// AST-based helper functions

interface FunctionInfo {
  name: string;
  type: "function" | "method" | "arrow" | "async";
  startLine: number;
  endLine: number;
  content: string;
}

async function extractFunctionFromContent(
  content: string,
  filename: string,
): Promise<FunctionInfo | null> {
  try {
    // Try AST parsing first
    const { getSymbolsForFile } = await import("../../../util/treeSitter");
    const symbols = await getSymbolsForFile(filename, content);

    if (symbols && symbols.length > 0) {
      const functionSymbols = symbols.filter(
        (symbol) =>
          symbol.type === "function_definition" ||
          symbol.type === "function_declaration" ||
          symbol.type === "method_definition" ||
          symbol.type === "method_declaration" ||
          symbol.type === "function_item" ||
          symbol.type === "function" ||
          symbol.type === "method" ||
          symbol.type === "arrow_function" ||
          symbol.type === "function_expression",
      );

      if (functionSymbols.length === 1) {
        const symbol = functionSymbols[0];
        let functionType: FunctionInfo["type"] = "function";
        if (symbol.content.includes("async ")) {
          functionType = "async";
        } else if (symbol.content.includes(" => ")) {
          functionType = "arrow";
        } else if (symbol.type.includes("method")) {
          functionType = "method";
        }

        return {
          name: symbol.name,
          type: functionType,
          startLine: symbol.range.start.line,
          endLine: symbol.range.end.line,
          content: symbol.content,
        };
      }
    }
  } catch (error) {
    console.debug(
      "AST parsing failed, falling back to regex:",
      error instanceof Error ? error.message : String(error),
    );
  }

  // Fallback to simplified regex for edge cases where AST parsing fails
  console.debug("Using simplified regex fallback for function extraction");
  const result = extractFunctionWithRegex(content);
  console.debug("Regex extraction result:", result ? result.name : "null");
  return result;
}

function extractFunctionWithRegex(content: string): FunctionInfo | null {
  const trimmedContent = content.trim();

  // Function patterns with capture groups for name - Updated to handle TypeScript syntax
  const patterns = [
    // Regular function: function name() { ... } or function name(): type { ... }
    {
      regex:
        /^(async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{[\s\S]*}$/s,
      nameIndex: 2,
      type: "function" as const,
      name: "function",
    },
    // Arrow function: const name = () => { ... } or const name = (): type => { ... }
    {
      regex:
        /^const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*{[\s\S]*};?$/s,
      nameIndex: 1,
      type: "arrow" as const,
      name: "arrow",
    },
    // Method: methodName() { ... } or methodName(): type { ... }
    {
      regex: /^(async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{[\s\S]*}$/s,
      nameIndex: 2,
      type: "method" as const,
      name: "method",
    },
  ];

  for (const pattern of patterns) {
    const match = trimmedContent.match(pattern.regex);

    if (match) {
      const functionName = match[pattern.nameIndex];
      if (functionName) {
        // Calculate approximate line positions
        const lines = trimmedContent.split("\n");
        const startLine = 0;
        const endLine = lines.length - 1;

        let functionType: FunctionInfo["type"] = pattern.type;
        if (match[0].includes("async ")) {
          functionType = "async";
        }

        return {
          name: functionName,
          type: functionType,
          startLine,
          endLine,
          content: trimmedContent,
        };
      }
    }
  }
  return null;
}

async function findFunctionInOldFileWithAST(
  oldFile: string,
  functionName: string,
  filename: string,
): Promise<{
  name: string;
  startLine: number;
  endLine: number;
  content: string;
} | null> {
  try {
    // Use getSymbolsForFile directly for consistency
    const { getSymbolsForFile } = await import("../../../util/treeSitter");
    const symbols = await getSymbolsForFile(filename, oldFile);

    console.debug(
      "findFunctionInOldFileWithAST symbols:",
      symbols?.length,
      "looking for:",
      functionName,
    );

    if (!symbols) {
      console.debug("No symbols found in old file");
      return null;
    }

    const matchingFunction = symbols.find(
      (symbol) =>
        symbol.name === functionName &&
        (symbol.type === "function_definition" ||
          symbol.type === "function_declaration" ||
          symbol.type === "method_definition" ||
          symbol.type === "method_declaration" ||
          symbol.type === "function_item" ||
          symbol.type === "arrow_function"),
    );

    console.debug(
      "Matching function found:",
      !!matchingFunction,
      matchingFunction?.name,
    );

    if (!matchingFunction) {
      console.debug("Function not found in old file, trying regex fallback");
      // Final fallback to regex-based implementation
      const result = findFunctionInOldFile(oldFile, functionName);
      return result || null;
    }

    return {
      name: matchingFunction.name,
      startLine: matchingFunction.range.start.line,
      endLine: matchingFunction.range.end.line - 1,
      content: matchingFunction.content,
    };
  } catch (error) {
    console.debug("Function search failed:", error);
    // Final fallback to regex-based implementation
    const result = findFunctionInOldFile(oldFile, functionName);
    return result || null;
  }
}

function calculateConfidenceWithAST(
  newContent: string,
  matchedFunction: {
    name: string;
    startLine: number;
    endLine: number;
    content: string;
  },
  newFunctionInfo: FunctionInfo,
): number {
  let confidence = 0.6; // Base confidence for AST-based matching

  // Compare function lengths - significant expansion suggests enhancement
  const oldLength = matchedFunction.content.length;
  const newLength = newContent.length;

  if (newLength > oldLength * 1.3) {
    confidence += 0.2;
  } else if (newLength < oldLength * 0.7) {
    confidence -= 0.1; // Significant reduction might be suspicious
  }

  // Look for enhancement indicators in the new content
  const enhancementPatterns = [
    /\/\/.*enhanced?/i,
    /\/\/.*improved?/i,
    /\/\/.*validation/i,
    /\/\/.*error.*handling/i,
    /try\s*{/,
    /catch\s*\(/,
    /throw\s+new\s+Error/,
    /console\.(log|error|warn|info)/,
    /if\s*\(.*\)\s*{\s*throw/,
    /await\s+/,
    /Promise\./,
  ];

  const enhancementCount = enhancementPatterns.filter((pattern) =>
    pattern.test(newContent),
  ).length;

  confidence += Math.min(enhancementCount * 0.05, 0.15);

  // Check for structural changes vs just formatting
  const normalizedOld = matchedFunction.content
    .replace(/\s+/g, " ")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  const normalizedNew = newContent
    .replace(/\s+/g, " ")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  if (normalizedOld === normalizedNew) {
    confidence -= 0.3; // Just formatting changes
  } else {
    // Calculate similarity to boost confidence for real changes
    const similarity = calculateStringSimilarity(normalizedOld, normalizedNew);
    if (similarity > 0.8) {
      confidence += 0.1; // High similarity with changes suggests refinement
    } else if (similarity < 0.3) {
      confidence += 0.2; // Low similarity suggests major rewrite
    }
  }

  return Math.max(0, Math.min(1, confidence));
}

function calculateStringSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance-based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Detect if the new content is a bare function replacement
 */
