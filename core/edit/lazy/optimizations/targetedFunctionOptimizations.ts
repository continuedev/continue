import { DiffLine } from "../../..";
import { deterministicApplyLazyEdit } from "../deterministicLazyEdit";

/**
 * Targeted function replacement optimization
 * Handles scenarios where user provides a function wrapped in lazy comments,
 * intending to replace a specific function in the existing file
 */
export async function targetedFunctionAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableTargetedFunctionOptimizations = true,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableTargetedFunctionOptimizations?: boolean;
}): Promise<DiffLine[] | undefined> {
  if (!enableTargetedFunctionOptimizations) {
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
    });
  }

  try {
    // Analyze if this is a targeted function replacement scenario
    const analysis = analyzeTargetedFunction(oldFile, newLazyFile, filename);

    if (!analysis.isTargetedFunction) {
      console.debug(
        "Not a targeted function scenario - confidence:",
        analysis.confidence,
        "function name:",
        analysis.functionName,
      );
      return undefined; // Not a targeted function scenario
    }

    console.debug(
      "Targeted function replacement detected:",
      analysis.functionName,
      "confidence:",
      analysis.confidence,
      "has match:",
      !!analysis.matchedFunction,
    );

    // Apply targeted function optimization
    return await applyTargetedFunctionReplacement(
      oldFile,
      newLazyFile,
      filename,
      analysis,
    );
  } catch (error) {
    console.debug("Targeted function optimization failed:", error);
    console.debug(
      "Error details - oldFile length:",
      oldFile.length,
      "newLazyFile length:",
      newLazyFile.length,
    );
    return undefined;
  }
}

interface TargetedFunctionAnalysis {
  isTargetedFunction: boolean;
  functionName: string;
  functionType: "function" | "method" | "arrow" | "async";
  confidence: number;
  extractedFunction: string;
  matchedFunction?: {
    name: string;
    startLine: number;
    endLine: number;
    content: string;
  };
}

function analyzeTargetedFunction(
  oldFile: string,
  newLazyFile: string,
  filename: string,
): TargetedFunctionAnalysis {
  const newFileContent = newLazyFile.trim();

  // Check if the new file has lazy markers OR is a single function replacement
  const hasLazyMarkers =
    newFileContent.includes("... existing code ...") ||
    newFileContent.includes("... rest of") ||
    newFileContent.includes("... other") ||
    newFileContent.includes("... same ...");

  // Even without lazy markers, check if this is a single function replacement
  let extractedFunctions: string[] = [];

  if (hasLazyMarkers) {
    // Extract functions with lazy markers
    extractedFunctions = extractFunctionsFromLazyContent(newFileContent);
  } else {
    // Check if entire content is a single function (bare function replacement)
    const trimmedContent = newFileContent.trim();
    if (isSingleFunction(trimmedContent)) {
      extractedFunctions = [trimmedContent];
    }
  }

  if (!hasLazyMarkers && extractedFunctions.length === 0) {
    return {
      isTargetedFunction: false,
      functionName: "",
      functionType: "function",
      confidence: 0,
      extractedFunction: "",
    };
  }

  if (extractedFunctions.length === 0) {
    return {
      isTargetedFunction: false,
      functionName: "",
      functionType: "function",
      confidence: 0,
      extractedFunction: "",
    };
  }

  // Handle the primary function (first non-trivial one)
  const extractedFunction = extractedFunctions[0];

  // Analyze the extracted function with improved patterns
  const functionPatterns = [
    // Regular function: function name() { ... }
    /^\s*(async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/m,
    // Class method: methodName() { ... } or async methodName() { ... }
    /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*{/m,
    // Arrow function assigned: const name = () => { ... }
    /^\s*const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>\s*{/m,
    // Arrow function with explicit async: const name = async () => { ... }
    /^\s*const\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>\s*{/m,
  ];

  let functionName = "";
  let functionType: TargetedFunctionAnalysis["functionType"] = "function";
  let isMatch = false;

  for (const pattern of functionPatterns) {
    const match = extractedFunction.match(pattern);
    if (match) {
      // Extract function name from correct capture group
      if (match[0].includes("function")) {
        functionName = match[2]; // Regular function
        functionType = match[1] ? "async" : "function";
      } else if (match[0].includes("const")) {
        functionName = match[1]; // Arrow function
        functionType = "arrow";
      } else {
        functionName = match[2] || match[1]; // Class method
        functionType = match[1] ? "async" : "method";
      }
      isMatch = true;
      break;
    }
  }

  if (!isMatch || !functionName) {
    return {
      isTargetedFunction: false,
      functionName: "",
      functionType: "function",
      confidence: 0,
      extractedFunction,
    };
  }

  // Check if this function exists in the old file
  const matchedFunction = findFunctionInOldFile(oldFile, functionName);

  // For lazy edits, we should proceed even if function doesn't exist (might be adding new function)
  let confidence = 0.8; // Higher base confidence for lazy marker scenarios

  if (matchedFunction) {
    // Function exists - this is likely a replacement
    const oldFunctionBody = extractFunctionBody(matchedFunction.content);
    const newFunctionBody = extractFunctionBody(extractedFunction);

    if (oldFunctionBody.trim() === newFunctionBody.trim()) {
      // Content is identical - lower confidence
      confidence = 0.3;
    } else {
      // Content is different - higher confidence for replacement
      confidence = 0.9;
    }
  } else {
    // Function doesn't exist - could be addition, moderate confidence
    confidence = 0.7;
  }

  // Boost confidence for clear modification indicators
  const modificationPatterns = [
    /\/\/.*enhanced?/i,
    /\/\/.*improved?/i,
    /\/\/.*updated?/i,
    /\/\/.*fixed?/i,
    /\/\/.*validate/i,
    /throw new Error/,
    /console\.(log|error|warn|info)/,
    /this\.\w+\(/, // Method calls
    /if\s*\(/, // Conditional logic
    /for\s*\(/, // Loops
    /while\s*\(/, // Loops
  ];

  const modificationMatches = modificationPatterns.filter((pattern) =>
    pattern.test(extractedFunction),
  ).length;

  confidence += Math.min(modificationMatches * 0.05, 0.15);

  return {
    isTargetedFunction: confidence > 0.6,
    functionName,
    functionType,
    confidence,
    extractedFunction,
    matchedFunction,
  };
}
function isSingleFunction(content: string): boolean {
  // Check if the entire content is a single function definition
  const trimmedContent = content.trim();

  // Function patterns
  const functionPatterns = [
    /^\s*(async\s+)?function\s+\w+\s*\([^)]*\)\s*{/,
    /^\s*(async\s+)?\w+\s*\([^)]*\)\s*{/,
    /^\s*const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>\s*{/,
    /^\s*const\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*{/,
  ];

  // Check if it starts with a function pattern
  const startsWithFunction = functionPatterns.some((pattern) =>
    pattern.test(trimmedContent),
  );

  if (!startsWithFunction) {
    return false;
  }

  // Count braces to ensure it's a complete single function
  let braceCount = 0;
  let hasOpeningBrace = false;
  let functionEnded = false;

  for (let i = 0; i < trimmedContent.length; i++) {
    const char = trimmedContent[i];
    if (char === "{") {
      braceCount++;
      hasOpeningBrace = true;
    } else if (char === "}") {
      braceCount--;
      if (hasOpeningBrace && braceCount === 0) {
        // Function ended - check if there's meaningful content after
        const remaining = trimmedContent.slice(i + 1).trim();
        if (remaining.length > 0) {
          // There's more content after the function - not a single function
          return false;
        }
        functionEnded = true;
        break;
      }
    }
  }

  // Must have properly closed braces and ended the function
  return hasOpeningBrace && braceCount === 0 && functionEnded;
}

function extractFunctionFromLazyContent(content: string): string {
  // Remove lazy markers and extract the function
  const lines = content.split("\n");
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip lazy marker lines
    if (
      trimmedLine.includes("... existing code ...") ||
      trimmedLine.includes("... rest of") ||
      trimmedLine.includes("... other") ||
      trimmedLine.includes("... same ...")
    ) {
      continue;
    }

    // Keep non-empty lines
    if (trimmedLine) {
      cleanLines.push(line);
    }
  }
  return cleanLines.join("\n").trim();
}

function extractFunctionsFromLazyContent(content: string): string[] {
  // Remove lazy markers and extract all functions
  const lines = content.split("\n");
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip lazy marker lines
    if (
      trimmedLine.includes("... existing code ...") ||
      trimmedLine.includes("... rest of") ||
      trimmedLine.includes("... other") ||
      trimmedLine.includes("... same ...")
    ) {
      continue;
    }

    // Keep non-empty lines
    if (trimmedLine) {
      cleanLines.push(line);
    }
  }

  const cleanContent = cleanLines.join("\n").trim();

  if (!cleanContent) {
    return [];
  }

  // Split into individual functions
  // This is a simplified approach - could be enhanced with proper AST parsing
  const functions = splitIntoFunctions(cleanContent);
  return functions.filter((f) => f.trim().length > 0);
}

function splitIntoFunctions(content: string): string[] {
  const lines = content.split("\n");
  const functions: string[] = [];
  let currentFunction: string[] = [];
  let braceCount = 0;
  let inFunction = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line starts a function
    const functionPatterns = [
      /^(async\s+)?function\s+\w+\s*\(/,
      /^(async\s+)?\w+\s*\([^)]*\)\s*{/,
      /^const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
    ];

    const isStartOfFunction = functionPatterns.some((pattern) =>
      pattern.test(trimmedLine),
    );

    if (isStartOfFunction && !inFunction) {
      // Start of a new function
      if (currentFunction.length > 0) {
        functions.push(currentFunction.join("\n"));
      }
      currentFunction = [line];
      inFunction = true;
      braceCount = 0;
    } else if (inFunction) {
      currentFunction.push(line);
    }

    // Count braces to track function boundaries
    for (const char of line) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0 && inFunction) {
          // End of function
          functions.push(currentFunction.join("\n"));
          currentFunction = [];
          inFunction = false;
        }
      }
    }
  }

  // Add any remaining function
  if (currentFunction.length > 0) {
    functions.push(currentFunction.join("\n"));
  }

  return functions;
}

function extractFunctionBody(functionContent: string): string {
  // Extract just the body content between the first { and last }
  const lines = functionContent.split("\n");
  let braceCount = 0;
  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (let j = 0; j < line.length; j++) {
      if (line[j] === "{") {
        braceCount++;
        if (startIndex === -1) startIndex = i;
      } else if (line[j] === "}") {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex !== -1) break;
  }

  if (startIndex !== -1 && endIndex !== -1) {
    const bodyLines = lines.slice(startIndex, endIndex + 1);
    // Remove the opening and closing braces and return the content
    if (bodyLines.length > 2) {
      return bodyLines.slice(1, -1).join("\n").trim();
    }
  }

  return functionContent;
}

/**
 * Enhanced AST-based function finding with regex fallback
 */
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

    if (!symbols) {
      console.debug("No symbols found in old file, falling back to regex");
      const result = findFunctionInOldFile(oldFile, functionName);
      return result || null;
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

    if (!matchingFunction) {
      console.debug("Function not found in AST, trying regex fallback");
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
    console.debug("AST function search failed:", error);
    // Final fallback to regex-based implementation
    const result = findFunctionInOldFile(oldFile, functionName);
    return result || null;
  }
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

  // Enhanced patterns for better TypeScript support
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

async function applyTargetedFunctionReplacement(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  analysis: TargetedFunctionAnalysis,
): Promise<DiffLine[]> {
  const matchedFunction = analysis.matchedFunction;

  if (matchedFunction) {
    // Function exists - generate direct diff for replacement
    console.debug(
      "Generating direct diff for function replacement:",
      analysis.functionName,
    );

    return generateDirectFunctionReplacementDiff(
      oldFile,
      analysis.extractedFunction,
      matchedFunction,
    );
  } else {
    // Function doesn't exist - try to add it in the right place
    // For class methods, find the class and add the method
    // For standalone functions, add at the end or in logical place

    const processedLazyFile = processLazyFileForAddition(
      oldFile,
      newLazyFile,
      analysis,
    );

    return (
      (await deterministicApplyLazyEdit({
        oldFile,
        newLazyFile: processedLazyFile,
        filename,
      })) || []
    );
  }
}

function generateDirectFunctionReplacementDiff(
  oldFile: string,
  newFunction: string,
  matchedFunction: {
    name: string;
    startLine: number;
    endLine: number;
    content: string;
  },
): DiffLine[] {
  const oldLines = oldFile.split("\n");
  const newFunctionLines = newFunction.split("\n");
  const diffLines: DiffLine[] = [];

  // Add unchanged lines before the function
  for (let i = 0; i < matchedFunction.startLine; i++) {
    diffLines.push({
      type: "same",
      line: oldLines[i],
    });
  }

  // Add old function lines as deletions
  for (let i = matchedFunction.startLine; i <= matchedFunction.endLine; i++) {
    diffLines.push({
      type: "old",
      line: oldLines[i],
    });
  }

  // Add new function lines as additions
  for (const line of newFunctionLines) {
    diffLines.push({
      type: "new",
      line: line,
    });
  }

  // Add unchanged lines after the function
  for (let i = matchedFunction.endLine + 1; i < oldLines.length; i++) {
    diffLines.push({
      type: "same",
      line: oldLines[i],
    });
  }

  return diffLines;
}

function processLazyFileForAddition(
  oldFile: string,
  newLazyFile: string,
  analysis: TargetedFunctionAnalysis,
): string {
  // Check if this looks like a class method addition
  const isClassMethod =
    oldFile.includes("class ") && analysis.functionType === "method";

  if (isClassMethod) {
    // Find the class and insert the method before the closing brace
    const oldLines = oldFile.split("\n");
    const classPattern = /^class\s+\w+/;
    let classStartLine = -1;
    let classEndLine = -1;
    let braceCount = 0;
    let inClass = false;

    for (let i = 0; i < oldLines.length; i++) {
      const line = oldLines[i];

      if (classPattern.test(line.trim()) && !inClass) {
        classStartLine = i;
        inClass = true;
      }

      if (inClass) {
        for (const char of line) {
          if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;
            if (braceCount === 0) {
              classEndLine = i;
              break;
            }
          }
        }
        if (classEndLine !== -1) break;
      }
    }

    if (classStartLine !== -1 && classEndLine !== -1) {
      // Insert the new method before the class closing brace
      const beforeClass = oldLines.slice(0, classEndLine).join("\n");
      const afterClass = oldLines.slice(classEndLine).join("\n");

      return `${beforeClass}\n\n  ${analysis.extractedFunction.split("\n").join("\n  ")}\n${afterClass}`;
    }
  }

  // Fallback: try to use the lazy file as-is with deterministic processing
  return newLazyFile;
}

/**
 * Detect if the new content is a targeted function replacement with lazy comments
 */
