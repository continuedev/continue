/**
 * Track whether any unhandled errors occurred during execution.
 * This module exists separately to avoid circular dependencies between
 * index.ts and exit.ts.
 */

// Track whether any unhandled errors occurred during execution
let hasUnhandledError = false;

/**
 * Mark that an unhandled error has occurred.
 * This will cause gracefulExit to exit with code 1 even if 0 was requested.
 */
export function markUnhandledError(): void {
  hasUnhandledError = true;
}

/**
 * Check if any unhandled errors occurred during execution.
 * @returns true if an unhandled error was detected
 */
export function hadUnhandledError(): boolean {
  return hasUnhandledError;
}
