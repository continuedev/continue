type JsonObject = Record<string, unknown>;

function asJsonObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

/**
 * Extract the human-readable message nested inside a provider error blob.
 *
 * Gemini-style errors arrive as a JSON envelope ({ error: { message, code,
 * status } }) whose error.message is often ITSELF a JSON string (see
 * continuedev/continue#12945) — without extraction users see raw JSON or
 * "Unknown error". Walks the nesting to the innermost message; returns
 * undefined for non-JSON, malformed, or message-less input so callers keep
 * the original text. Mirrors extractNestedGeminiError in
 * packages/openai-adapters/src/apis/Gemini.ts (kept as a small local mirror
 * with shared test vectors rather than a new cross-package export).
 */
export function extractNestedJsonMessage(raw: string): string | undefined {
  // Bound the unwrap depth so a gateway returning deeply nested error
  // envelopes cannot force unbounded sequential parses.
  const MAX_DEPTH = 8;
  let node: unknown;
  try {
    node = JSON.parse(raw);
  } catch {
    return undefined;
  }

  let message: string | undefined;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const obj = asJsonObject(node);
    if (!obj) {
      break;
    }
    const target = asJsonObject(obj.error) ?? obj;
    if (typeof target.message !== "string") {
      break;
    }
    message = target.message;
    try {
      node = JSON.parse(target.message.trim());
    } catch {
      break;
    }
  }

  // A blank extracted message is worse than the original text — report
  // "nothing found" so callers keep the raw envelope.
  const trimmed = message?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/**
 * Safely formats an error object into a readable string
 */
export function formatError(error: any): string {
  if (error instanceof Error) {
    return extractNestedJsonMessage(error.message) ?? error.message;
  }

  if (typeof error === "string") {
    return extractNestedJsonMessage(error) ?? error;
  }

  if (error && typeof error === "object") {
    // Try to extract common error properties
    if (error.message) {
      if (typeof error.message === "string") {
        return extractNestedJsonMessage(error.message) ?? error.message;
      }
      return error.message;
    }
    if (error.error) {
      return formatError(error.error);
    }
    if (error.details) {
      return formatError(error.details);
    }
    if (error.description) {
      return error.description;
    }

    // For API errors, try to extract meaningful info
    if (error.status && error.error && error.error.message) {
      return `HTTP ${error.status}: ${error.error.message}`;
    }

    // For network errors
    if (error.code && error.syscall) {
      return `Network error: ${error.code} in ${error.syscall}`;
    }

    // For errors with an errors array
    if (error.errors && Array.isArray(error.errors)) {
      return error.errors.join(", ");
    }

    // Try to JSON stringify if possible
    try {
      return JSON.stringify(error);
    } catch {
      // If JSON.stringify fails, return a generic message
      return `An error occurred: ${Object.prototype.toString.call(error)}`;
    }
  }

  return String(error);
}

// Anthropic errors are stringfied JSON objects, format them to be more user friendly
export function formatAnthropicError(error: any): string {
  const prefix = "Anthropic:";

  if (error instanceof Error) {
    if (
      error.message.includes("authentication_error") &&
      error.message.includes("invalid x-api-key")
    ) {
      return `${prefix} Invalid API key`;
    }

    return `${prefix} ${error.message}`;
  }

  return `${prefix} ${String(error)}`;
}
