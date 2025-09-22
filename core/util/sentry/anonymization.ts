import * as Sentry from "@sentry/node";
import { type Event } from "@sentry/core";
/**
 * Minimalist Sentry anonymization utilities
 */

// Browser-compatible hash function (avoids Node.js crypto dependency)
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

/**
 * Anonymize file paths - keep package names, remove user paths
 */
export function anonymizeFilePath(filePath: string): string {
  if (!filePath) return filePath;

  const normalized = filePath.replace(/\\/g, "/");

  // Keep node_modules package names for debugging
  if (normalized.includes("node_modules")) {
    const match = normalized.match(/node_modules\/([^\/]+)/);
    if (match) {
      return `node_modules/${match[1]}/<file>`;
    }
  }

  // Replace absolute paths with generic identifier
  if (normalized.startsWith("/") || normalized.match(/^[A-Za-z]:/)) {
    return "<file>";
  }

  return normalized;
}

/**
 * Clean stack trace frames - remove sensitive data but keep the event
 */
export function anonymizeStackTrace(frames: any[]): any[] {
  if (!Array.isArray(frames)) return frames;

  return frames.map((frame) => ({
    ...frame,
    filename: frame.filename
      ? anonymizeFilePath(frame.filename)
      : frame.filename,
    abs_path: "",
    // Remove local variables and source code context
    vars: undefined,
    pre_context: undefined,
    post_context: undefined,
    context_line: frame.context_line ? "<code>" : frame.context_line,
  }));
}

/**
 * Anonymize user information - hash ID, remove PII
 */
export function anonymizeUserInfo(user: any): any {
  if (!user) return user;

  return {
    id: user.id ? simpleHash(String(user.id)) : user.id,
    username: undefined,
    email: undefined,
    ip_address: undefined,
  };
}

/**
 * Main anonymization function - minimalist approach like Rasa
 */
export function anonymizeSentryEvent(event: any): any | null {
  try {
    // Deep copy to avoid mutating the original event
    const anonymized = structuredClone(event);

    // Clean exception stack traces
    if (anonymized.exception?.values) {
      anonymized.exception.values = anonymized.exception.values.map(
        (exception: any) => ({
          ...exception,
          stacktrace: exception.stacktrace
            ? {
                ...exception.stacktrace,
                frames: exception.stacktrace.frames
                  ? anonymizeStackTrace(exception.stacktrace.frames)
                  : exception.stacktrace.frames,
              }
            : exception.stacktrace,
        }),
      );
    }

    // Clean thread stack traces
    if (anonymized.threads?.values) {
      anonymized.threads.values = anonymized.threads.values.map(
        (thread: any) => ({
          ...thread,
          stacktrace: thread.stacktrace
            ? {
                ...thread.stacktrace,
                frames: thread.stacktrace.frames
                  ? anonymizeStackTrace(thread.stacktrace.frames)
                  : thread.stacktrace.frames,
              }
            : thread.stacktrace,
        }),
      );
    }

    // Anonymize user info
    if (anonymized.user) {
      anonymized.user = anonymizeUserInfo(anonymized.user);
    }

    // Remove OS environment variables
    if (anonymized.contexts?.os?.environment) {
      anonymized.contexts.os.environment = undefined;
    }

    return anonymized;
  } catch (error) {
    console.error("Error anonymizing Sentry event:", error);
    return null; // Drop event if anonymization fails
  }
}
