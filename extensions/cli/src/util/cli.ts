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

export function isServe(): boolean {
  return process.argv?.includes("serve") ?? false;
}

/**
 * Check if running in a TTY-less environment
 * Returns true if stdin, stdout, and stderr are all not TTYs
 */
export function isTTYless(): boolean {
  return (
    process.stdin.isTTY !== true &&
    process.stdout.isTTY !== true &&
    process.stderr.isTTY !== true
  );
}

/**
 * Check if environment supports interactive features (TUI)
 * Returns false if in headless mode or TTY-less environment
 */
export function supportsInteractive(): boolean {
  return !isTTYless() && !isHeadlessMode();
}

/**
 * Check if a prompt was supplied via CLI arguments
 * Used to determine if stdin reading should be skipped
 */
export function hasSuppliedPrompt(): boolean {
  const args = process.argv.slice(2);
  const printIndex = args.findIndex((arg) => arg === "-p" || arg === "--print");

  if (printIndex === -1) {
    return false;
  }

  // Check if there's a non-flag argument after -p/--print
  // or if there are --prompt or --agent flags
  const hasPromptArg =
    args.length > printIndex + 1 && !args[printIndex + 1].startsWith("-");
  const hasPromptFlag = args.includes("--prompt");
  const hasAgentFlag = args.includes("--agent");

  return hasPromptArg || hasPromptFlag || hasAgentFlag;
}
