/**
 * Ensures proper process exit with flushed output streams
 * This is crucial for Windows compatibility where output may be buffered
 */
export async function safeExit(code: number = 0): Promise<never> {
  // Flush stdout
  if (process.stdout && !process.stdout.destroyed) {
    await new Promise<void>((resolve) => {
      process.stdout.write("", () => resolve());
    });
  }

  // Flush stderr
  if (process.stderr && !process.stderr.destroyed) {
    await new Promise<void>((resolve) => {
      process.stderr.write("", () => resolve());
    });
  }

  // Give OS a moment to flush buffers
  await new Promise((resolve) => setImmediate(resolve));

  process.exit(code);
}