/**
 * Configures the logger based on the application mode (headless or interactive)
 * When in headless mode, console.info is suppressed to avoid verbose output
 */
export function configureLogger(isHeadless: boolean): void {
  if (isHeadless) {
    // Save the original console.info function
    const originalConsoleInfo = console.info;
    
    // Override console.info to be a no-op in headless mode
    console.info = function() {
      // Do nothing in headless mode
    };
    
    // Add a method to restore original behavior if needed
    (console as any).restoreInfo = function() {
      console.info = originalConsoleInfo;
    };
  }
}