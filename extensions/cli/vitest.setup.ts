import { vi } from "vitest";

import { resetConsoleOverrides } from "./src/init.js";

// Disable telemetry for tests
process.env.CONTINUE_CLI_ENABLE_TELEMETRY = "0";

// Mock the 'open' package to prevent browser opening during tests
vi.mock("open", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

// Mock constructSystemMessage to avoid service container issues in tests
vi.mock("./src/systemMessage.js", () => ({
  constructSystemMessage: vi
    .fn()
    .mockResolvedValue(
      "You are an agent in the Continue CLI. Given the user's prompt, you should use the tools available to you to answer the user's question.",
    ),
}));

// Mock environment for tests
process.env.CONTINUE_GLOBAL_DIR = "/tmp/continue-test";

// Set up global afterEach hook to clear all timers and reset console
afterEach(() => {
  // Clear vitest timers
  vi.clearAllTimers();

  // Reset console overrides to ensure clean state for each test
  try {
    resetConsoleOverrides();
  } catch {
    // Ignore errors when resetting console
  }
});
