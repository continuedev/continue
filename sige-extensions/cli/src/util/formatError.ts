/**
 * Safely formats an error object into a readable string
 */
export function formatError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    // Try to extract common error properties
    if (error.message) {
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
