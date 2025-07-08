import { DiffLine } from "../..";
import { deterministicApplyLazyEdit } from "./deterministicLazyEdit";
import { bareFunctionAwareLazyEdit } from "./optimizations/bareFunctionOptimizations";
import { markdownAwareLazyEdit } from "./optimizations/markdownOptimizations";
import { reorderAwareLazyEdit } from "./optimizations/reorderAwareOptimizations";
import { similarFunctionAwareLazyEdit } from "./optimizations/similarFunctionOptimizations";
import { targetedFunctionAwareLazyEdit } from "./optimizations/targetedFunctionOptimizations";
import { testAwareLazyEdit } from "./optimizations/testFileOptimizations";

interface UnifiedLazyEditConfig {
  enableAllOptimizations?: boolean;
  enableIncrementalOptimizations?: boolean;
  enableCoordinatedFunctionOptimization?: boolean;
  enableSimilarFunctionOptimization?: boolean;
  enableReorderOptimization?: boolean;
  enableTestOptimization?: boolean;
  enableMarkdownOptimization?: boolean;
  enableBareFunctionOptimization?: boolean;
  enableTargetedFunctionOptimization?: boolean;
  fallbackToOriginal?: boolean;
  maxProcessingTime?: number;
}

const DEFAULT_CONFIG: UnifiedLazyEditConfig = {
  enableAllOptimizations: true,
  enableIncrementalOptimizations: true,
  enableCoordinatedFunctionOptimization: true,
  enableSimilarFunctionOptimization: true,
  enableReorderOptimization: true,
  enableTestOptimization: true,
  enableMarkdownOptimization: true,
  enableBareFunctionOptimization: true,
  enableTargetedFunctionOptimization: true,
  fallbackToOriginal: true,
  maxProcessingTime: 10000,
};

/**
 * Analyze the type of change to prioritize optimizations - Enhanced version
 */
function analyzeChangeType(
  oldFile: string,
  newLazyFile: string,
): {
  isHighRemoval: boolean;
  hasRemoval: boolean;
  removalRatio: number;
  isBareFunction: boolean;
  isTargetedFunction: boolean;
} {
  const oldLines = oldFile.split("\n").length;
  const newLines = newLazyFile.split("\n").length;
  const removalRatio = Math.max(0, (oldLines - newLines) / oldLines);

  // Check for explicit removal markers
  const hasRemovalMarkers = /REMOVE:|{{ *REMOVE|\/\/ *REMOVE/i.test(
    newLazyFile,
  );

  // Enhanced bare function detection
  const trimmedNew = newLazyFile.trim();
  const looksLikeFunction = isLikelyFunction(trimmedNew);
  const isShort = newLines < oldLines * 0.5; // New content is significantly shorter
  const noLazyMarkers = !trimmedNew.includes("... existing code ...");

  // More sophisticated bare function detection
  let isBareFunction = false;
  if (looksLikeFunction && noLazyMarkers) {
    // Check if this is a complete function replacement (not just a snippet)
    const hasCompleteFunction =
      trimmedNew.includes("{") && trimmedNew.includes("}");
    const functionName = extractFunctionName(trimmedNew);

    if (hasCompleteFunction && functionName) {
      // Check if the function exists in the old file
      const existsInOldFile = oldFile.includes(functionName);
      isBareFunction = existsInOldFile;
    }
  }

  // Enhanced targeted function detection
  const hasLazyMarkers = trimmedNew.includes("... existing code ...");
  let isTargetedFunction = false;
  if (hasLazyMarkers && looksLikeFunction) {
    const functionName = extractFunctionName(trimmedNew);
    if (functionName) {
      // Check if the function exists in the old file
      const existsInOldFile = oldFile.includes(functionName);
      isTargetedFunction = existsInOldFile;
    }
  }

  return {
    isHighRemoval: removalRatio > 0.3 || hasRemovalMarkers,
    hasRemoval: removalRatio > 0.1 || hasRemovalMarkers,
    removalRatio,
    isBareFunction,
    isTargetedFunction,
  };
}

/**
 * Enhanced function detection
 */
function isLikelyFunction(text: string): boolean {
  const functionPatterns = [
    /^(async\s+)?function\s+\w+\s*\(/,
    /^(async\s+)?\w+\s*\([^)]*\)\s*{/,
    /^const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
    /^\s*\w+\s*\([^)]*\)\s*{/, // Method definition
  ];

  return functionPatterns.some((pattern) => pattern.test(text));
}
/**
 * Extract function name from text
 */
function extractFunctionName(text: string): string | null {
  const patterns = [
    /^(async\s+)?function\s+(\w+)\s*\(/,
    /^(async\s+)?(\w+)\s*\([^)]*\)\s*{/,
    /^const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
    /^\s*(\w+)\s*\([^)]*\)\s*{/, // Method definition
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[2] || match[1]; // Different capture groups for different patterns
    }
  }

  return null;
}

/**
 * Detect if lazy file contains multiple coordinated changes
 */
async function detectMultipleChanges(
  oldFile: string,
  newLazyFile: string,
  filename: string,
): Promise<{
  hasMultipleChanges: boolean;
  changes: Array<{
    type: "new_function" | "modified_function" | "import_addition" | "other";
    functionName?: string;
    content: string;
    confidence: number;
  }>;
  coordinatedChange: boolean;
}> {
  const isJavaScript = /\.(js|jsx|ts|tsx)$/i.test(filename);
  if (!isJavaScript) {
    return { hasMultipleChanges: false, changes: [], coordinatedChange: false };
  }

  const changes: Array<{
    type: "new_function" | "modified_function" | "import_addition" | "other";
    functionName?: string;
    content: string;
    confidence: number;
  }> = [];

  // Split content into logical blocks (functions, imports, etc.)
  const blocks = newLazyFile.split(/\n\s*\n/).filter((block) => block.trim());

  for (const block of blocks) {
    const trimmedBlock = block.trim();

    // Check if it's a function
    if (isLikelyFunction(trimmedBlock)) {
      const functionName = extractFunctionName(trimmedBlock);
      const existsInOld = functionName && oldFile.includes(functionName);

      changes.push({
        type: existsInOld ? "modified_function" : "new_function",
        functionName: functionName || undefined,
        content: trimmedBlock,
        confidence: functionName ? 0.9 : 0.6,
      });
    }
    // Check if it's an import/require
    else if (/^(import|const.*require|from)/.test(trimmedBlock)) {
      changes.push({
        type: "import_addition",
        content: trimmedBlock,
        confidence: 0.8,
      });
    }
    // Other content
    else if (trimmedBlock.length > 10) {
      changes.push({
        type: "other",
        content: trimmedBlock,
        confidence: 0.3,
      });
    }
  }

  const hasMultipleChanges = changes.length > 1;

  // Detect coordinated changes (new helper + modified existing function)
  const newFunctions = changes.filter((c) => c.type === "new_function");
  const modifiedFunctions = changes.filter(
    (c) => c.type === "modified_function",
  );
  const coordinatedChange =
    newFunctions.length > 0 && modifiedFunctions.length > 0;

  if (coordinatedChange) {
    console.debug(
      `🔗 Coordinated change detected: ${newFunctions.length} new + ${modifiedFunctions.length} modified functions`,
    );
  }

  return { hasMultipleChanges, changes, coordinatedChange };
}

/**
 * Insert a new function into an existing file at the best location
 */
async function insertNewFunction(
  oldFile: string,
  newFunctionCode: string,
  functionName: string,
  filename: string,
): Promise<DiffLine[] | undefined> {
  console.debug(`🔧 Inserting new function: ${functionName}`);

  const oldLines = oldFile.split("\n");
  let newFunctionLines = newFunctionCode.split("\n");

  // Find the best insertion point and context
  const insertionInfo = findBestInsertionPointWithContext(
    oldLines,
    functionName,
    filename,
  );

  if (insertionInfo.point === -1) {
    console.debug(`❌ Could not find good insertion point for ${functionName}`);
    return undefined;
  }

  console.debug(
    `📍 Inserting ${functionName} at line ${insertionInfo.point} (context: ${insertionInfo.context})`,
  );

  // Apply proper indentation based on context
  if (insertionInfo.context === "class" && insertionInfo.indentation) {
    newFunctionLines = newFunctionLines.map((line, index) => {
      if (line.trim() === "") return line; // Keep empty lines as-is
      if (index === 0) {
        // First line: apply class member indentation
        return insertionInfo.indentation + line.trim();
      } else {
        // Subsequent lines: preserve relative indentation but add base indentation
        const trimmed = line.trimStart();
        const originalIndent = line.length - trimmed.length;
        return insertionInfo.indentation + " ".repeat(originalIndent) + trimmed;
      }
    });
  }

  // Create the result by inserting the new function
  const resultLines = [...oldLines];

  // Add spacing based on context
  let insertLines = [...newFunctionLines];

  // For class context, just add blank line before if needed
  if (insertionInfo.context === "class") {
    const needsSpacingBefore =
      insertionInfo.point > 0 &&
      oldLines[insertionInfo.point - 1].trim() !== "";
    if (needsSpacingBefore) {
      insertLines.unshift("");
    }
  } else {
    // For other contexts, add spacing as before
    const needsSpacingBefore =
      insertionInfo.point > 0 &&
      oldLines[insertionInfo.point - 1].trim() !== "";
    const needsSpacingAfter =
      insertionInfo.point < oldLines.length &&
      oldLines[insertionInfo.point].trim() !== "";

    if (needsSpacingBefore) {
      insertLines.unshift("");
    }
    if (needsSpacingAfter) {
      insertLines.push("");
    }
  }

  resultLines.splice(insertionInfo.point, 0, ...insertLines);

  // Generate diff
  const { myersDiff } = await import("../../diff/myers");
  return myersDiff(oldFile, resultLines.join("\n"));
}

/**
 * Find the best place to insert a new function with context information
 */
function findBestInsertionPointWithContext(
  oldLines: string[],
  functionName: string,
  filename: string,
): {
  point: number;
  context: "class" | "function" | "global";
  indentation?: string;
} {
  // Strategy 1: Look for class structure and insert before closing brace
  const isJavaScript = /\.(js|jsx|ts|tsx)$/i.test(filename);

  if (isJavaScript) {
    // Look for class definition
    let classStartLine = -1;
    let classEndLine = -1;
    let braceDepth = 0;
    let inClass = false;

    for (let i = 0; i < oldLines.length; i++) {
      const line = oldLines[i];

      if (line.match(/^\s*class\s+\w+/)) {
        classStartLine = i;
        inClass = true;
        braceDepth = 0;
      }

      if (inClass) {
        // Count braces to find class end
        for (const char of line) {
          if (char === "{") braceDepth++;
          if (char === "}") braceDepth--;
        }

        if (braceDepth === 0 && classStartLine !== -1) {
          classEndLine = i;
          break;
        }
      }
    }

    // If we found a class, insert before the closing brace
    if (classStartLine !== -1 && classEndLine !== -1) {
      // Look for the last method in the class
      let lastMethodLine = classStartLine;
      let methodIndentation = "  "; // Default indentation

      for (let i = classStartLine + 1; i < classEndLine; i++) {
        const line = oldLines[i];
        if (
          line.match(/^\s+\w+\s*\([^)]*\)\s*{/) ||
          line.match(/^\s+(async\s+)?\w+\s*\([^)]*\)\s*{/)
        ) {
          lastMethodLine = i;
          // Extract indentation from existing method
          const match = line.match(/^(\s+)/);
          if (match) {
            methodIndentation = match[1];
          }
        }
      }

      // Find the end of the last method
      let methodEndLine = lastMethodLine;
      let methodBraceDepth = 0;
      for (let i = lastMethodLine; i < classEndLine; i++) {
        const line = oldLines[i];
        for (const char of line) {
          if (char === "{") methodBraceDepth++;
          if (char === "}") methodBraceDepth--;
        }
        if (methodBraceDepth === 0 && i > lastMethodLine) {
          methodEndLine = i;
          break;
        }
      }

      // Insert after the last method
      return {
        point: methodEndLine + 1,
        context: "class",
        indentation: methodIndentation,
      };
    }
  }

  // Strategy 2: Look for similar function patterns and insert nearby
  const functionLines: number[] = [];
  for (let i = 0; i < oldLines.length; i++) {
    const line = oldLines[i];
    if (
      line.match(/^\s*(async\s+)?function\s+\w+/) ||
      line.match(/^\s*(async\s+)?\w+\s*\([^)]*\)\s*{/) ||
      line.match(/^\s*const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>/)
    ) {
      functionLines.push(i);
    }
  }

  if (functionLines.length > 0) {
    // Insert after the last function
    const lastFunctionLine = functionLines[functionLines.length - 1];

    // Find the end of this function
    let braceDepth = 0;
    let functionEndLine = lastFunctionLine;
    for (let i = lastFunctionLine; i < oldLines.length; i++) {
      const line = oldLines[i];
      for (const char of line) {
        if (char === "{") braceDepth++;
        if (char === "}") braceDepth--;
      }
      if (braceDepth === 0 && i > lastFunctionLine) {
        functionEndLine = i;
        break;
      }
    }

    return {
      point: functionEndLine + 1,
      context: "function",
      indentation: "",
    };
  }

  // Strategy 3: Insert at the end of the file
  return {
    point: oldLines.length,
    context: "global",
    indentation: "",
  };
}

/**
 * Find the best place to insert a new function (legacy function for compatibility)
 */
function findBestInsertionPoint(
  oldLines: string[],
  functionName: string,
  filename: string,
): number {
  const result = findBestInsertionPointWithContext(
    oldLines,
    functionName,
    filename,
  );
  return result.point;
}

/**
 * Apply a diff to a string to reconstruct the result
 */
function applyDiffToString(originalContent: string, diff: DiffLine[]): string {
  const result: string[] = [];

  for (const line of diff) {
    if (line.type === "same" || line.type === "new") {
      result.push(line.line);
    }
    // Skip "old" lines as they are being removed/replaced
  }

  return result.join("\n");
}

/**
 * Apply iterative refinement - progressively apply changes one at a time, starting fresh each iteration
 */
async function applyIterativeRefinement(
  oldFile: string,
  originalLazyFile: string,
  filename: string,
  detectedChanges: Array<{
    type: "new_function" | "modified_function" | "import_addition" | "other";
    functionName?: string;
    content: string;
    confidence: number;
  }>,
): Promise<DiffLine[] | undefined> {
  console.debug("🔄 Starting iterative refinement approach");

  let currentFile = oldFile;
  let remainingChanges = [...detectedChanges];
  const appliedChanges: string[] = [];
  let iterations = 0;
  const maxIterations = 10; // Safety limit

  // Sort changes by priority: imports first, then new functions, then modifications
  const sortChanges = (changes: typeof detectedChanges) =>
    changes.sort((a, b) => {
      const order = {
        import_addition: 0,
        new_function: 1,
        modified_function: 2,
        other: 3,
      };
      return order[a.type] - order[b.type];
    });

  while (remainingChanges.length > 0 && iterations < maxIterations) {
    iterations++;
    console.debug(
      `\n🔄 Iteration ${iterations}: ${remainingChanges.length} changes remaining`,
    );

    // Sort remaining changes by priority
    const sortedChanges = sortChanges(remainingChanges);
    let appliedThisIteration = false;

    // Try to apply the highest priority change
    for (let i = 0; i < sortedChanges.length; i++) {
      const change = sortedChanges[i];
      console.debug(
        `🔧 Trying to apply: ${change.type}${change.functionName ? ` (${change.functionName})` : ""}`,
      );

      // Create a mini lazy file for just this change
      const miniLazyFile = change.content;
      let result: DiffLine[] | undefined;

      // Apply the best optimization for this change type
      if (change.type === "new_function" && change.functionName) {
        result = await insertNewFunction(
          currentFile,
          miniLazyFile,
          change.functionName,
          filename,
        );
      } else {
        // For all other changes in iterative mode, use deterministic approach
        // This avoids issues with optimizations getting confused by intermediate files
        console.debug(
          `Using deterministic approach for ${change.type} in iteration ${iterations}`,
        );
        result = await deterministicApplyLazyEdit({
          oldFile: currentFile,
          newLazyFile: miniLazyFile,
          filename,
        });
      }

      // If this change was applied successfully
      if (result && result.length > 0) {
        const newFile = applyDiffToString(currentFile, result);

        if (newFile && newFile !== currentFile) {
          console.debug(
            `✅ Applied: ${change.type}${change.functionName ? ` (${change.functionName})` : ""}`,
          );

          // Update current file for next iteration
          currentFile = newFile;

          // Remove this change from remaining changes
          remainingChanges = remainingChanges.filter(
            (_, idx) => sortedChanges.indexOf(change) !== idx,
          );

          // Track what we applied
          appliedChanges.push(
            `${change.type}${change.functionName ? `(${change.functionName})` : ""}`,
          );

          appliedThisIteration = true;
          break; // Move to next iteration
        }
      }

      console.debug(
        `❌ Failed to apply: ${change.type}${change.functionName ? ` (${change.functionName})` : ""}`,
      );
    }

    // If we couldn't apply any changes this iteration, we're stuck
    if (!appliedThisIteration) {
      console.debug(
        `⚠️ No changes could be applied in iteration ${iterations}, stopping`,
      );
      break;
    }
  }

  // Calculate final diff if we made any progress
  if (appliedChanges.length > 0) {
    const { myersDiff } = await import("../../diff/myers");
    const finalDiff = myersDiff(oldFile, currentFile);

    console.debug(
      `✅ Iterative refinement complete: ${appliedChanges.join(" → ")}`,
    );
    console.debug(
      `📊 Applied ${appliedChanges.length}/${detectedChanges.length} changes in ${iterations} iterations`,
    );
    console.debug(`📊 Final diff: ${finalDiff.length} lines`);

    return finalDiff;
  }

  console.debug(`❌ Iterative refinement failed: no changes could be applied`);
  return undefined;
}

/**
 * Apply optimizations incrementally, building up the result
 */
async function applyIncrementalOptimizations(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  config: UnifiedLazyEditConfig,
): Promise<DiffLine[] | undefined> {
  console.debug("🔄 Starting incremental optimizations");

  const multipleChanges = await detectMultipleChanges(
    oldFile,
    newLazyFile,
    filename,
  );

  if (!multipleChanges.hasMultipleChanges) {
    console.debug(
      "❌ No multiple changes detected, falling back to single optimization",
    );
    return undefined;
  }

  // Skip iterative approach for coordinated changes - fall back to single optimizations
  if (multipleChanges.coordinatedChange) {
    console.debug(
      "⚠️ Coordinated changes detected, skipping iterative refinement to avoid conflicts",
    );
    return undefined;
  }

  console.debug(
    `📊 Detected ${multipleChanges.changes.length} changes:`,
    multipleChanges.changes.map(
      (c) => `${c.type}${c.functionName ? ` (${c.functionName})` : ""}`,
    ),
  );

  let currentFile = oldFile;
  let finalDiff: DiffLine[] = [];
  const appliedSteps: string[] = [];

  // Process changes in optimal order: imports first, new functions, then modifications
  const sortedChanges = multipleChanges.changes.sort((a, b) => {
    const order = {
      import_addition: 0,
      new_function: 1,
      modified_function: 2,
      other: 3,
    };
    return order[a.type] - order[b.type];
  });

  for (let i = 0; i < sortedChanges.length; i++) {
    const change = sortedChanges[i];
    console.debug(
      `\n🔧 Step ${i + 1}: Processing ${change.type}${change.functionName ? ` (${change.functionName})` : ""}`,
    );

    // Create a mini lazy file for this specific change
    const miniLazyFile = change.content;

    // Try to apply the best optimization for this change type
    let stepResult: DiffLine[] | undefined;

    if (change.type === "new_function" && change.functionName) {
      // For new functions, we need to INSERT them, not replace existing ones
      // Try to find a good insertion point and create a synthetic lazy edit
      stepResult = await insertNewFunction(
        currentFile,
        miniLazyFile,
        change.functionName,
        filename,
      );
    } else if (change.type === "modified_function" && change.functionName) {
      // For modified functions, try targeted function optimization
      stepResult = await targetedFunctionAwareLazyEdit({
        oldFile: currentFile,
        newLazyFile: miniLazyFile,
        filename,
        enableTargetedFunctionOptimizations: true,
      });
    }

    // If optimization failed, try deterministic as fallback
    if (!stepResult || stepResult.length === 0) {
      console.debug(
        `❌ Optimization failed for step ${i + 1}, trying deterministic`,
      );
      stepResult = await deterministicApplyLazyEdit({
        oldFile: currentFile,
        newLazyFile: miniLazyFile,
        filename,
      });
    }

    if (stepResult && stepResult.length > 0) {
      // Apply this step's changes to get intermediate result
      const intermediateFile = applyDiffToString(currentFile, stepResult);

      if (intermediateFile) {
        currentFile = intermediateFile;
        appliedSteps.push(
          `${change.type}${change.functionName ? `(${change.functionName})` : ""}`,
        );
        console.debug(`✅ Step ${i + 1} applied successfully`);

        // Accumulate the diff - we'll need to recalculate the final diff from original to final
      } else {
        console.debug(`❌ Step ${i + 1} failed to apply`);
        // If any step fails, return undefined to fall back to single optimization
        return undefined;
      }
    } else {
      console.debug(`❌ Step ${i + 1} produced no result`);
      return undefined;
    }
  }

  // Calculate final diff from original file to final result
  if (appliedSteps.length > 0 && currentFile !== oldFile) {
    const { myersDiff } = await import("../../diff/myers");
    finalDiff = myersDiff(oldFile, currentFile);

    console.debug(
      `✅ Incremental optimization complete: ${appliedSteps.join(" → ")}`,
    );
    console.debug(`📊 Final diff: ${finalDiff.length} lines`);

    return finalDiff;
  }

  return undefined;
}

/**
 * Unified lazy edit that tries different optimizations based on file type - Enhanced version
 */
export async function unifiedLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  config = {},
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  config?: UnifiedLazyEditConfig;
}): Promise<DiffLine[] | undefined> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  console.debug(`\n🚀 UNIFIED LAZY EDIT START: ${filename}`);
  console.debug(
    `📊 Config: optimizations=${fullConfig.enableAllOptimizations}, incremental=${fullConfig.enableIncrementalOptimizations}, timeout=${fullConfig.maxProcessingTime}ms`,
  );

  if (!fullConfig.enableAllOptimizations) {
    console.debug(
      "❌ All optimizations disabled, using deterministic approach",
    );
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
    });
  }

  const startTime = Date.now();

  // Priority 0: Try incremental optimizations for coordinated changes
  if (fullConfig.enableIncrementalOptimizations) {
    console.debug("🔄 Trying incremental optimizations first");
    try {
      const incrementalResult = await applyIncrementalOptimizations(
        oldFile,
        newLazyFile,
        filename,
        fullConfig,
      );

      if (incrementalResult && incrementalResult.length > 0) {
        const elapsedTime = Date.now() - startTime;
        console.debug(
          `✅ SUCCESS with incremental optimizations in ${elapsedTime}ms (${incrementalResult.length} diff lines)`,
        );
        return incrementalResult;
      }

      console.debug(
        "❌ Incremental optimizations failed, falling back to single optimizations",
      );
    } catch (error) {
      console.debug(
        "❌ Incremental optimizations error:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Analyze the change type to prioritize optimizations
  const changeAnalysis = analyzeChangeType(oldFile, newLazyFile);
  console.debug(`🔍 Change Analysis:`, {
    isBareFunction: changeAnalysis.isBareFunction,
    isTargetedFunction: changeAnalysis.isTargetedFunction,
    hasRemoval: changeAnalysis.hasRemoval,
    removalRatio: `${(changeAnalysis.removalRatio * 100).toFixed(1)}%`,
  });

  // Determine file type
  const isMarkdown = /\.(md|markdown)$/i.test(filename);
  const isTest =
    /\.(test|spec)\.(js|ts|jsx|tsx)$/i.test(filename) ||
    filename.includes("__tests__");
  const isJavaScript = /\.(js|jsx|ts|tsx)$/i.test(filename);

  const fileType = isMarkdown
    ? "markdown"
    : isTest
      ? "test"
      : isJavaScript
        ? "javascript"
        : "other";
  console.debug(`📄 File Type: ${fileType}`);

  const attemptedStrategies: string[] = [];

  // Enhanced optimization selection with better error handling
  try {
    // Priority 1: Targeted function optimization for function replacements with lazy comments
    if (
      changeAnalysis.isTargetedFunction &&
      fullConfig.enableTargetedFunctionOptimization
    ) {
      const strategyName = "targeted-function";
      attemptedStrategies.push(strategyName);
      console.debug(
        `🎯 Strategy ${attemptedStrategies.length}: ${strategyName} (function: ${extractFunctionName(newLazyFile.trim())})`,
      );
      try {
        const result = await targetedFunctionAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableTargetedFunctionOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Priority 2: Bare function optimization for likely bare function scenarios
    if (
      changeAnalysis.isBareFunction &&
      fullConfig.enableBareFunctionOptimization
    ) {
      const strategyName = "bare-function";
      attemptedStrategies.push(strategyName);
      console.debug(
        `🔧 Strategy ${attemptedStrategies.length}: ${strategyName} (function: ${extractFunctionName(newLazyFile.trim())})`,
      );
      try {
        const result = await bareFunctionAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableBareFunctionOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Priority 3: File type specific optimizations
    if (isMarkdown && fullConfig.enableMarkdownOptimization) {
      const strategyName = "markdown-aware";
      attemptedStrategies.push(strategyName);
      console.debug(
        `📝 Strategy ${attemptedStrategies.length}: ${strategyName}`,
      );
      try {
        const result = await markdownAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableMarkdownOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (isTest && fullConfig.enableTestOptimization) {
      const strategyName = "test-aware";
      attemptedStrategies.push(strategyName);
      console.debug(
        `🧪 Strategy ${attemptedStrategies.length}: ${strategyName}`,
      );
      try {
        const result = await testAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableTestOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Priority 5: JavaScript/TypeScript files - try similar function optimization
    if (isJavaScript && fullConfig.enableSimilarFunctionOptimization) {
      const strategyName = "similar-function";
      attemptedStrategies.push(strategyName);
      console.debug(
        `🔄 Strategy ${attemptedStrategies.length}: ${strategyName}`,
      );
      try {
        const result = await similarFunctionAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableSimilarFunctionOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Priority 6: Try reorder-aware optimization
    if (fullConfig.enableReorderOptimization) {
      const strategyName = "reorder-aware";
      attemptedStrategies.push(strategyName);
      console.debug(
        `🔀 Strategy ${attemptedStrategies.length}: ${strategyName}`,
      );
      try {
        const result = await reorderAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableReorderOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Try bare function optimization if not already tried
    if (
      !changeAnalysis.isBareFunction &&
      fullConfig.enableBareFunctionOptimization &&
      isLikelyFunction(newLazyFile.trim())
    ) {
      const strategyName = "bare-function-fallback";
      attemptedStrategies.push(strategyName);
      console.debug(
        `🔧 Strategy ${attemptedStrategies.length}: ${strategyName}`,
      );
      try {
        const result = await bareFunctionAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableBareFunctionOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Try targeted function optimization if not already tried
    if (
      !changeAnalysis.isTargetedFunction &&
      fullConfig.enableTargetedFunctionOptimization &&
      newLazyFile.includes("... existing code ...")
    ) {
      const strategyName = "targeted-function-fallback";
      attemptedStrategies.push(strategyName);
      console.debug(
        `🎯 Strategy ${attemptedStrategies.length}: ${strategyName}`,
      );
      try {
        const result = await targetedFunctionAwareLazyEdit({
          oldFile,
          newLazyFile,
          filename,
          enableTargetedFunctionOptimizations: true,
        });
        if (result && result.length > 0) {
          const elapsedTime = Date.now() - startTime;
          console.debug(
            `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
          );
          return result;
        }
        console.debug(`❌ ${strategyName}: No result returned`);
      } catch (error) {
        console.debug(
          `❌ ${strategyName}: Failed -`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  } catch (error) {
    console.debug("⚠️ Optimization selection failed:", error);
  }

  // Enhanced fallback to deterministic with better error handling
  if (fullConfig.fallbackToOriginal) {
    const strategyName = "deterministic-fallback";
    attemptedStrategies.push(strategyName);
    console.debug(`🔄 Strategy ${attemptedStrategies.length}: ${strategyName}`);
    try {
      const result = await deterministicApplyLazyEdit({
        oldFile,
        newLazyFile,
        filename,
      });
      if (result && result.length > 0) {
        const elapsedTime = Date.now() - startTime;
        console.debug(
          `✅ SUCCESS with ${strategyName} in ${elapsedTime}ms (${result.length} diff lines)`,
        );
        return result;
      }
      console.debug(`❌ ${strategyName}: No result returned`);
    } catch (error) {
      console.debug(
        `❌ ${strategyName}: Failed -`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const elapsedTime = Date.now() - startTime;
  console.debug(
    `\n💥 ALL STRATEGIES FAILED for ${filename} in ${elapsedTime}ms`,
  );
  console.debug(`📊 Attempted strategies: ${attemptedStrategies.join(" → ")}`);
  return undefined;
}

/**
 * Export strategies for direct access
 */
export const strategies = {
  original: deterministicApplyLazyEdit,
  similarFunction: similarFunctionAwareLazyEdit,
  reorderAware: reorderAwareLazyEdit,
  testAware: testAwareLazyEdit,
  markdownAware: markdownAwareLazyEdit,
  bareFunction: bareFunctionAwareLazyEdit,
  targetedFunction: targetedFunctionAwareLazyEdit,
};

/**
 * Simple analysis function
 */
export async function analyzeLazyEditFile(
  oldFile: string,
  newLazyFile: string,
  filename: string,
) {
  const isMarkdown = /\.(md|markdown)$/i.test(filename);
  const isTest =
    /\.(test|spec)\.(js|ts|jsx|tsx)$/i.test(filename) ||
    filename.includes("__tests__");
  const isJavaScript = /\.(js|jsx|ts|tsx)$/i.test(filename);

  const changeAnalysis = analyzeChangeType(oldFile, newLazyFile);

  return {
    fileType: isMarkdown
      ? "markdown"
      : isTest
        ? "test_file"
        : isJavaScript
          ? "javascript"
          : "other",

    recommendedStrategy: changeAnalysis.isTargetedFunction
      ? "targeted_function"
      : changeAnalysis.isBareFunction
        ? "bare_function"
        : isMarkdown
          ? "markdown_aware"
          : isTest
            ? "test_aware"
            : "similar_function",
    confidence: 0.8,
    changeType: {
      ...changeAnalysis,
    },
  };
}
