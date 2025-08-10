import * as fs from "fs";

/**
 * Reads input from stdin if available (when data is piped in)
 * Returns null if stdin is a TTY (interactive terminal) or if no data available
 */
export function readStdinSync(): string | null {
  try {
    // Check if stdin is a TTY (interactive terminal)
    // On some systems process.stdin.isTTY might be undefined, so we also check if it's not false
    if (process.stdin.isTTY !== false) {
      // If it's true or undefined, assume it's a TTY unless we can prove otherwise
      try {
        // Try to read with a non-blocking approach
        const stdinData = fs.readFileSync(0, "utf8");
        return stdinData.trim();
      } catch (error: any) {
        // If we get EAGAIN or similar, it means no data is available (TTY)
        if (error.code === "EAGAIN" || error.code === "EWOULDBLOCK") {
          return null;
        }
        // For other errors, also return null
        return null;
      }
    }

    // If isTTY is explicitly false, try to read stdin
    const stdinData = fs.readFileSync(0, "utf8");
    return stdinData.trim();
  } catch {
    return null;
  }
}
