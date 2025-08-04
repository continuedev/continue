import { vi } from "vitest";
import { resetConsoleOverrides } from "./src/util/consoleOverride.js";

// Disable telemetry for tests
process.env.CONTINUE_CLI_ENABLE_TELEMETRY = "0";

// Mock the 'open' package to prevent browser opening during tests
vi.mock("open", () => ({
  default: vi.fn().mockResolvedValue(undefined)
}));

// Set up global afterEach hook to clear all timers and reset console
afterEach(() => {
  // Clear vitest timers
  vi.clearAllTimers();
  
  // Reset console overrides to ensure clean state for each test
  try {
    resetConsoleOverrides();
  } catch (e) {
    // Ignore errors when resetting console
  }
});