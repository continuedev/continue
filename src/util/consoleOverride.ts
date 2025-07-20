/**
 * Console override utility to prevent unwanted output in headless mode
 * This ensures that only intentional stdout output reaches the user
 */

interface ConsoleBackup {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
  debug: typeof console.debug;
}

let originalConsole: ConsoleBackup | null = null;
let isHeadlessMode = false;

/**
 * Override console methods to prevent unwanted output in headless mode
 * In headless mode, only console.error and explicitly allowed outputs should reach stdout
 */
export function configureConsoleForHeadless(headless: boolean): void {
  isHeadlessMode = headless;
  
  if (headless && !originalConsole) {
    // Backup original console methods
    originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    // Override console methods to suppress output in headless mode
    console.log = () => {}; // Suppress all console.log
    console.info = () => {}; // Suppress all console.info  
    console.warn = () => {}; // Suppress all console.warn
    console.debug = () => {}; // Suppress all console.debug
    
    // Keep console.error for genuine errors, but send to stderr
    console.error = (...args: any[]) => {
      originalConsole!.error(...args);
    };
  } else if (!headless && originalConsole) {
    // Restore original console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    
    originalConsole = null;
  }
}

/**
 * Safe stdout output that bypasses console overrides
 * Use this for intentional output in headless mode
 */
export function safeStdout(message: string): void {
  process.stdout.write(message);
}

/**
 * Safe stderr output that bypasses console overrides  
 * Use this for error messages that should always be visible
 */
export function safeStderr(message: string): void {
  process.stderr.write(message);
}

/**
 * Temporarily restore console for a specific operation
 * Useful for debugging or when you need original console behavior
 */
export function withOriginalConsole<T>(fn: () => T): T {
  if (!originalConsole || !isHeadlessMode) {
    return fn();
  }

  // Temporarily restore
  const tempConsole = { ...console };
  Object.assign(console, originalConsole);
  
  try {
    return fn();
  } finally {
    // Restore overrides
    Object.assign(console, tempConsole);
  }
}

/**
 * Check if currently in headless mode
 */
export function isInHeadlessMode(): boolean {
  return isHeadlessMode;
}