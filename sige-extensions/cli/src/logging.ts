import chalk from "chalk";

// Track if we're in headless mode (default to false)
let isHeadlessMode = false;

/**
 * Configure the logger to enable/disable headless mode
 */
export function configureLogger(options: { headless: boolean }) {
  isHeadlessMode = options.headless;
}

/**
 * Check if logging is currently enabled
 * This will return false if in headless mode unless specifically exempted
 */
export function isLoggingEnabled(forceEnable = false): boolean {
  return !isHeadlessMode || forceEnable;
}

/**
 * Wrapper for console.info that respects headless mode
 * If forceLog is true, it will log even in headless mode
 */
export function log(message: any, forceLog = false): void {
  if (isLoggingEnabled(forceLog)) {
    console.info(message);
  }
}

/**
 * Wrapper for console.error that respects headless mode
 * Errors are generally important, so we default forceLog to true
 */
export function error(message: any, forceLog = true): void {
  if (isLoggingEnabled(forceLog)) {
    console.error(message);
  }
}

/**
 * Wrapper for console.info that respects headless mode
 */
export function info(message: any, forceLog = false): void {
  if (isLoggingEnabled(forceLog)) {
    console.info(message);
  }
}

/**
 * Wrapper for console.warn that respects headless mode
 */
export function warn(message: any, forceLog = false): void {
  if (isLoggingEnabled(forceLog)) {
    console.warn(message);
  }
}

/**
 * Colored logging helpers that respect headless mode
 */
export const loggers = {
  success: (message: string, forceLog = false) =>
    log(chalk.green(message), forceLog),
  info: (message: string, forceLog = false) =>
    log(chalk.blue(message), forceLog),
  warning: (message: string, forceLog = false) =>
    log(chalk.yellow(message), forceLog),
  error: (message: string, forceLog = true) =>
    error(chalk.red(message), forceLog),
  debug: (message: string, forceLog = false) =>
    log(chalk.gray(message), forceLog),
  command: (message: string) => log(message, true), // Always show command outputs
};
