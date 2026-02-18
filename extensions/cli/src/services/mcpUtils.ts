import { SseError } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Check if an error is an authentication error that should trigger token refresh
 * 405 is technically "not allowed" but some servers like Sanity don't return the correct error
 * Since we're using mcp library there's a good chance 405 means auth issue and doesn't hurt to retry with auth
 */
export function isAuthError(error: unknown): boolean {
  return (
    (error instanceof SseError && error.code === 401) ||
    (error instanceof SseError && error.code === 405) ||
    (error instanceof StreamableHTTPError && error.code === 401) ||
    (error instanceof StreamableHTTPError && error.code === 405) ||
    (error instanceof Error && error.message.includes("401")) ||
    (error instanceof Error && error.message.includes("405")) ||
    (error instanceof Error && error.message.includes("Unauthorized"))
  );
}
