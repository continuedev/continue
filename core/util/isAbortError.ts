/**
 * Unified abort error detection.
 * Covers all known abort patterns in the Continue codebase:
 * - String literal "cancel" (streaming cancellation)
 * - Error with name "AbortError" (node-fetch, DOM)
 * - Error with code "ABORT_ERR" (Node.js AbortSignal)
 * - DOMException with name "AbortError" (browser/Node.js 18+)
 * - Plain objects with name "AbortError" (serialized errors)
 */
export function isAbortError(error: unknown): boolean {
  if (error === null || error === undefined) return false;

  // String-based "cancel" (used in Continue streaming path)
  if (error === "cancel") return true;

  // Standard Error objects
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    if ("code" in error && (error as any).code === "ABORT_ERR") return true;
  }

  // DOMException (browser/Node.js 18+)
  // In some runtimes DOMException does not extend Error, so check separately.
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }

  // Plain objects with name property (e.g. serialized errors across boundaries)
  if (typeof error === "object" && "name" in error) {
    const name = (error as any).name;
    if (typeof name === "string" && name === "AbortError") return true;
  }

  return false;
}
