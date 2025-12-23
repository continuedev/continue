/**
 * Error tracking module for CLI
 * Tracks whether any unhandled errors occurred during execution
 */

// Track whether any unhandled errors occurred during execution
let hasUnhandledError = false;

/**
 * Mark that an unhandled error has occurred
 */
export function markUnhandledError(): void {
  hasUnhandledError = true;
}

/**
 * Check if any unhandled errors occurred during execution
 */
export function hadUnhandledError(): boolean {
  return hasUnhandledError;
}
