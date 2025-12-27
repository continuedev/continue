import * as fs from "fs";
import * as path from "path";

import { vi } from "vitest";

import { resetConsoleOverrides } from "./src/init.js";

// Disable telemetry for tests
process.env.CONTINUE_CLI_ENABLE_TELEMETRY = "0";
process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY = "0";

// Mock core/util/paths to read CONTINUE_GLOBAL_DIR dynamically
// This fixes test isolation issues where the module caches the env var at load time
vi.mock("core/util/paths.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("core/util/paths.js")>();

  // Create a dynamic version of getContinueGlobalPath that reads env var each time
  const getContinueGlobalPath = () => {
    const continuePath =
      process.env.CONTINUE_GLOBAL_DIR ||
      path.join(process.env.HOME || "", ".continue");
    if (!fs.existsSync(continuePath)) {
      fs.mkdirSync(continuePath, { recursive: true });
    }
    return continuePath;
  };

  const getIndexFolderPath = () => {
    const indexPath = path.join(getContinueGlobalPath(), "index");
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(indexPath, { recursive: true });
    }
    return indexPath;
  };

  const getGlobalContextFilePath = () => {
    return path.join(getIndexFolderPath(), "globalContext.json");
  };

  return {
    ...actual,
    getContinueGlobalPath,
    getIndexFolderPath,
    getGlobalContextFilePath,
  };
});

// Mock fetch to prevent actual API calls in tests
const originalFetch = global.fetch;
global.fetch = vi
  .fn()
  .mockImplementation(async (url: string | URL, ...args) => {
    const urlString = url.toString();

    // Mock the default config API call
    if (urlString.includes("get-assistant/continuedev/default-cli-config")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          configResult: {
            config: {
              name: "Default Config",
              version: "0.0.1",
              schema: "v1",
              models: [
                {
                  provider: "anthropic",
                  name: "claude-sonnet-4-5",
                  apiKey: "test-key",
                  roles: ["chat"],
                },
              ],
              rules: [],
              mcpServers: [],
            },
            errors: [],
          },
        }),
      };
    }
    return originalFetch(url, ...args);
  });

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
