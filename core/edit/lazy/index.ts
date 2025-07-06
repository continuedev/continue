/**
 * Unified Lazy Edit System - Main Entry Point
 *
 * This module provides the main entry point for the enhanced deterministic lazy edit system
 * that intelligently selects the best optimization strategy based on file type and content analysis.
 */

// Main unified system

export {
  analyzeLazyEditFile,
  strategies,
  unifiedLazyEdit,
} from "./unifiedLazyEdit";

// Configuration system

export type { LazyEditConfig, ProcessingMetrics } from "./config";

export {
  AGGRESSIVE_LAZY_EDIT_CONFIG,
  CONFIG_PRESETS,
  CONSERVATIVE_LAZY_EDIT_CONFIG,
  createLazyEditConfig,
  DEFAULT_LAZY_EDIT_CONFIG,
  getEnvironmentConfig,
  globalConfigManager,
  LazyEditConfigManager,
  MINIMAL_LAZY_EDIT_CONFIG,
  validateLazyEditConfig,
} from "./config";

// Individual optimization strategies (for direct access if needed)
export { deterministicApplyLazyEdit as originalDeterministicApplyLazyEdit } from "./deterministicLazyEdit";

export { similarFunctionAwareLazyEdit } from "./optimizations/similarFunctionOptimizations";

export { reorderAwareLazyEdit } from "./optimizations/reorderAwareOptimizations";

export { testAwareLazyEdit } from "./optimizations/testFileOptimizations";

export {
  markdownAwareLazyEdit,
  markdownUtils,
} from "./optimizations/markdownOptimizations";

export {
  importAwareLazyEdit,
  importUtils,
} from "./optimizations/importOptimizations";

// Utility functions
export { findInAst } from "./findInAst";

// Import necessary dependencies for setup functions
import { CONFIG_PRESETS, globalConfigManager } from "./config";
import { unifiedLazyEdit } from "./unifiedLazyEdit";

/**
 * Quick setup functions for common use cases
 */

/**
 * Configure the system for documentation editing (markdown-focused)
 */
export function setupForDocumentation() {
  globalConfigManager.updateConfig(CONFIG_PRESETS.documentation);
}

/**
 * Configure the system for code editing (javascript/typescript-focused)
 */
export function setupForCodebase() {
  globalConfigManager.updateConfig(CONFIG_PRESETS.codebase);
}

/**
 * Configure the system for test file editing
 */
export function setupForTesting() {
  globalConfigManager.updateConfig(CONFIG_PRESETS.testing);
}

/**
 * Configure the system for mixed content editing (all optimizations enabled)
 */
export function setupForMixed() {
  globalConfigManager.updateConfig(CONFIG_PRESETS.mixed);
}

/**
 * Reset to default configuration
 */
export function resetToDefault() {
  globalConfigManager.updateConfig(CONFIG_PRESETS.default);
}

/**
 * Enable debug logging for troubleshooting
 */
export function enableDebugMode() {
  globalConfigManager.updateConfig({
    enableDebugLogging: true,
    enableMetrics: true,
  });
}

/**
 * Disable all optimizations (use original algorithm only)
 */
export function disableOptimizations() {
  globalConfigManager.updateConfig({
    enableAllOptimizations: false,
  });
}

/**
 * Get processing statistics
 */
export function getProcessingStats() {
  return {
    successRate: globalConfigManager.getSuccessRate(),
    averageProcessingTime: globalConfigManager.getAverageProcessingTime(),
    totalProcessed: globalConfigManager.getMetrics().length,
    recentMetrics: globalConfigManager.getMetrics().slice(-10),
  };
}

/**
 * Simple wrapper for backward compatibility with existing code
 */
export async function applyLazyEdit(
  oldFile: string,
  newLazyFile: string,

  filename: string,
) {
  return unifiedLazyEdit({ oldFile, newLazyFile, filename });
}

// Re-export types from core
export type { DiffLine } from "../..";

/**
 * Version information
 */
export const VERSION = {
  major: 2,
  minor: 0,
  patch: 0,

  label: "unified",
  full: "2.0.0-unified",
};
