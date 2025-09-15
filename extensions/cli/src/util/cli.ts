/**
 * Utility functions for CLI operations
 */

/**
 * Check if running in headless mode (-p/--print flags)
 */
export function isHeadlessMode(): boolean {
  const args = process.argv.slice(2);
  return args.includes("-p") || args.includes("--print");
}
