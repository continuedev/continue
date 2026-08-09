/**
 * Early initialization that must happen before ANY other imports
 * This file intercepts console and stdout/stderr to prevent dependency logging
 */

import { isHeadlessMode as checkIsHeadlessMode } from "./util/cli.js";

// Check if we're in headless mode by looking at process arguments
// We need to do this before any imports to catch early logging
const isHeadlessMode = checkIsHeadlessMode();

// Store original methods before ANY dependencies can use them
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.trace,
  table: console.table,
  dir: console.dir,
  dirxml: console.dirxml,
  group: console.group,
  groupEnd: console.groupEnd,
  groupCollapsed: console.groupCollapsed,
  time: console.time,
  timeEnd: console.timeEnd,
  timeLog: console.timeLog,
  clear: console.clear,
  count: console.count,
  countReset: console.countReset,
  assert: console.assert,
};

// Track if we're inside our own code vs dependency code
let isHeadlessModeConfigured = false;

// Override console methods if in headless mode
if (isHeadlessMode) {
  // Override ALL console methods to no-ops
  Object.keys(originalConsole).forEach((method) => {
    (console as any)[method] = () => {};
  });

  // Override stdout/stderr to block everything by default
  process.stdout.write = function (
    chunk: any,
    encoding?: any,
    callback?: any,
  ): boolean {
    // Always return true to indicate success, but don't actually write
    if (typeof encoding === "function") {
      encoding();
      return true;
    }
    if (typeof callback === "function") {
      callback();
    }
    return true;
  };

  process.stderr.write = function (
    chunk: any,
    encoding?: any,
    callback?: any,
  ): boolean {
    // Always return true to indicate success, but don't actually write
    if (typeof encoding === "function") {
      encoding();
      return true;
    }
    if (typeof callback === "function") {
      callback();
    }
    return true;
  };
}

/**
 * Configure console for headless mode
 * Since init.ts already blocks everything, this just tracks state
 * and provides the safe output functions
 */
export function configureConsoleForHeadless(headless: boolean): void {
  isHeadlessModeConfigured = headless;

  // init.ts should have already handled the blocking if in headless mode
  // This function now mainly exists for compatibility and state tracking
}

/**
 * Safe stdout output that bypasses all overrides
 * Use this for intentional output in headless mode
 */
export function safeStdout(message: string): void {
  if (isHeadlessMode || isHeadlessModeConfigured) {
    // Use the original stdout that was saved before any overrides
    originalStdoutWrite(message);
  } else {
    // In non-headless mode, just use normal stdout
    process.stdout.write(message);
  }
}

/**
 * Safe stderr output that bypasses all overrides
 * Use this for error messages that should always be visible
 */
export function safeStderr(message: string): void {
  if (isHeadlessMode || isHeadlessModeConfigured) {
    // Use the original stderr that was saved before any overrides
    originalStderrWrite(message);
  } else {
    // In non-headless mode, just use normal stderr
    process.stderr.write(message);
  }
}

/**
 * Reset console overrides to original state
 * Note: This won't affect init.ts overrides which happen at module load
 */
export function resetConsoleOverrides(): void {
  isHeadlessModeConfigured = false;
  // The actual console restoration would need to happen in init.ts
  // This is mainly for testing purposes
}
