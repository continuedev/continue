/**
 * Utility functions for CLI operations
 */

import EventEmitter from "events";

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

  // Check if --prompt flag is present (indicates a prompt is coming)
  // Note: --agent doesn't supply a prompt, it just specifies which agent to use
  // Piped stdin should still be read when --agent is present
  const hasPromptFlag = args.includes("--prompt");
  if (hasPromptFlag) {
    return true;
  }

  // Check if there's a non-flag argument after -p/--print
  // We need to skip flags that take values (like --config, --model, etc.)
  // Known flags that take values
  const flagsWithValues = new Set([
    "--config",
    "--model",
    "--output",
    "--mode",
    "--workflow",
    "--agent",
    "-m",
    "-c",
    "-o",
  ]);

  const argsAfterPrint = args.slice(printIndex + 1);
  for (let i = 0; i < argsAfterPrint.length; i++) {
    const arg = argsAfterPrint[i];

    // If this is a flag that takes a value, skip both the flag and its value
    if (flagsWithValues.has(arg)) {
      i++; // Skip the next argument (the value)
      continue;
    }

    // If this is any other flag (starts with -), skip it
    if (arg.startsWith("-")) {
      continue;
    }

    // Found a non-flag argument - this is the prompt
    return true;
  }

  return false;
}

export const escapeEvents = new EventEmitter();
