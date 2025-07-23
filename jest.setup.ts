import { jest } from "@jest/globals";

// Disable telemetry for tests
process.env.CONTINUE_CLI_ENABLE_TELEMETRY = "0";

// Mock the 'open' package to prevent browser opening during tests
jest.mock("open", () => jest.fn().mockResolvedValue(undefined));

// Mock common modules that cause issues
jest.mock("./src/logging.js");
jest.mock("./src/util/logger.js");
jest.mock("./src/hooks/useService.js");
jest.mock("./src/auth/workos.js");
jest.mock("./src/commands/commands.js");
jest.mock("./src/services/index.js");

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