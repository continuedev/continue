/**
 * Module to track unhandled errors during CLI execution.
 * This is in a separate file to avoid circular dependencies between
 * index.ts and exit.ts.
 */

// Track whether any unhandled errors occurred during execution
let hasUnhandledError = false;

/**
 * Mark that an unhandled error occurred.
 * Called by global error handlers in index.ts.
 */
export function markUnhandledError(): void {
  hasUnhandledError = true;
}

/**
 * Check if any unhandled errors occurred during execution.
 * Called by gracefulExit() to determine the exit code.
 */
export function hadUnhandledError(): boolean {
  return hasUnhandledError;
}
