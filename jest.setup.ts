// Disable telemetry for tests
process.env.CONTINUE_CLI_ENABLE_TELEMETRY = "0";

// Set up global afterEach hook to clear all timers
afterEach(() => {
  // Clear jest timers only if they're available
  if (typeof jest !== "undefined" && jest.clearAllTimers) {
    try {
      jest.clearAllTimers();
    } catch (e) {
      // Ignore errors when clearing timers
    }
  }
});