import { DiffLine } from "../..";
import { deterministicApplyLazyEdit } from "./deterministicLazyEdit";
import { markdownAwareLazyEdit } from "./optimizations/markdownOptimizations";
import { reorderAwareLazyEdit } from "./optimizations/reorderAwareOptimizations";
import { similarFunctionAwareLazyEdit } from "./optimizations/similarFunctionOptimizations";
import { testAwareLazyEdit } from "./optimizations/testFileOptimizations";

interface UnifiedLazyEditConfig {
  enableAllOptimizations?: boolean;
  enableSimilarFunctionOptimization?: boolean;
  enableReorderOptimization?: boolean;
  enableTestOptimization?: boolean;
  enableMarkdownOptimization?: boolean;
  fallbackToOriginal?: boolean;
  maxProcessingTime?: number;
}

const DEFAULT_CONFIG: UnifiedLazyEditConfig = {
  enableAllOptimizations: true,
  enableSimilarFunctionOptimization: true,
  enableReorderOptimization: true,
  enableTestOptimization: true,
  enableMarkdownOptimization: true,
  fallbackToOriginal: true,
  maxProcessingTime: 10000,
};

/**
 * Unified lazy edit that tries different optimizations based on file type
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

  if (!fullConfig.enableAllOptimizations) {
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
    });
  }

  // Determine file type
  const isMarkdown = /\.(md|markdown)$/i.test(filename);
  const isTest =
    /\.(test|spec)\.(js|ts|jsx|tsx)$/i.test(filename) ||
    filename.includes("__tests__");
  const isJavaScript = /\.(js|jsx|ts|tsx)$/i.test(filename);

  // Try specialized optimizations first
  try {
    // Markdown files
    if (isMarkdown && fullConfig.enableMarkdownOptimization) {
      const result = await markdownAwareLazyEdit({
        oldFile,
        newLazyFile,
        filename,
        enableMarkdownOptimizations: true,
      });
      if (result) return result;
    }

    // Test files
    if (isTest && fullConfig.enableTestOptimization) {
      const result = await testAwareLazyEdit({
        oldFile,
        newLazyFile,
        filename,
        enableTestOptimizations: true,
      });
      if (result) return result;
    }

    // JavaScript/TypeScript files - try similar function optimization
    if (isJavaScript && fullConfig.enableSimilarFunctionOptimization) {
      const result = await similarFunctionAwareLazyEdit({
        oldFile,
        newLazyFile,
        filename,
        enableSimilarFunctionOptimizations: true,
      });
      if (result) return result;
    }

    // Try reorder-aware optimization
    if (fullConfig.enableReorderOptimization) {
      const result = await reorderAwareLazyEdit({
        oldFile,
        newLazyFile,
        filename,
        enableReorderOptimizations: true,
      });
      if (result) return result;
    }
  } catch (error) {
    console.debug("Optimization failed:", error);
  }

  // Fallback to original
  if (fullConfig.fallbackToOriginal) {
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
    });
  }

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

  return {
    fileType: isMarkdown
      ? "markdown"
      : isTest
        ? "test_file"
        : isJavaScript
          ? "javascript"
          : "other",
    recommendedStrategy: isMarkdown
      ? "markdown_aware"
      : isTest
        ? "test_aware"
        : "similar_function",
    confidence: 0.8,
  };
}
