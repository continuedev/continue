/**
 * Waits for process output to stabilize
 * This helps ensure all output is captured on Windows
 */
export async function waitForOutput(timeout: number = 100): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

/**
 * Process exit delay for tests
 * Windows needs extra time to flush output buffers
 */
export const TEST_EXIT_DELAY = process.platform === "win32" ? 200 : 50;