/**
 * Unified abort error detection.
 * Handles all known abort error patterns across different environments.
 */
export function isAbortError(error: unknown): boolean {
  // String-based "cancel" (used in Continue codebase)
  if (error === "cancel") return true;

  // Standard Error objects
  if (error instanceof Error) {
    if (error.name.includes("AbortError")) return true;
    if ("code" in error && (error as any).code === "ABORT_ERR") return true;
  }

  // DOMException (browser/Node.js 18+)
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  )
    return true;

  // Handle plain objects with name property
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as any).name;
    if (typeof name === "string" && name.includes("AbortError")) return true;
  }

  return false;
}
