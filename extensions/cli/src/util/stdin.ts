import * as fs from "fs";

/**
 * Reads input from stdin if available (when data is piped in)
 * Returns null if stdin is a TTY (interactive terminal) or if no data available
 */
export function readStdinSync(): string | null {
  try {
    // In test environments, don't attempt to read stdin to avoid hanging
    // But allow CI environments to read stdin when it's clearly piped
    if (
      process.env.NODE_ENV === "test" ||
      process.env.VITEST === "true" ||
      process.env.JEST_WORKER_ID !== undefined ||
      process.env.CONTINUE_CLI_TEST === "true"
    ) {
      return null;
    }

    // Special handling for CI environments - allow reading if stdin is clearly not a TTY
    if (process.env.CI === "true" && process.stdin.isTTY === true) {
      return null;
    }

    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY === true) {
      // Definitely a TTY, don't read
      return null;
    }

    // If isTTY is false, we likely have piped input
    if (process.stdin.isTTY === false) {
      // Try to read stdin with a fallback
      try {
        const stdinData = fs.readFileSync(0, "utf8");
        return stdinData.trim();
      } catch {
        return null;
      }
    }

    // If isTTY is undefined, be cautious and check if we can read non-blockingly
    // This handles cases where TTY detection is unreliable
    try {
      // Use readFileSync with fd 0 but wrap in timeout logic
      const stdinData = fs.readFileSync(0, "utf8");
      return stdinData.trim();
    } catch {
      // If we can't read (EAGAIN, EWOULDBLOCK, etc.), assume no piped input
      return null;
    }
  } catch {
    return null;
  }
}
