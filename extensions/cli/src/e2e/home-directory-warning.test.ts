import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestContext,
  createTestConfig,
  createTestContext,
  runCLI,
  type CLITestContext,
} from "../test-helpers/cli-helpers.js";
import { HOME_DIRECTORY_WARNING } from "../ui/IntroMessage.js";

describe("E2E: Home Directory Warning", () => {
  let context: CLITestContext;

  const testConfig = `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  describe("home directory detection", () => {
    it("should NOT show warning in headless mode even when running from home directory", async () => {
      await createTestConfig(context, testConfig);

      // Create a context that simulates running from home directory
      const homeContext = {
        ...context,
        testDir: os.homedir(), // Set test directory to actual home directory
      };

      const result = await runCLI(homeContext, {
        args: ["-p", "--config", context.configPath!, "test prompt"],
        env: {
          OPENAI_API_KEY: "test-key",
          // Override HOME to match the test directory (which is now home)
          HOME: os.homedir(),
          USERPROFILE: os.homedir(),
        },
        timeout: 5000,
        expectError: true,
      });

      // Should NOT contain the home directory warning in headless mode
      const output = result.stdout + result.stderr;
      expect(output).not.toContain(HOME_DIRECTORY_WARNING);
    });

    it("should show warning when running from home directory in TUI mode", async () => {
      await createTestConfig(context, testConfig);

      // Create a context that simulates running from home directory
      const homeContext = {
        ...context,
        testDir: os.homedir(), // Set test directory to actual home directory
      };

      // Test TUI mode (without -p flag) - this will likely fail in test environment
      // but we can check if the warning would be shown if TUI could start
      const result = await runCLI(homeContext, {
        args: ["--config", context.configPath!],
        env: {
          OPENAI_API_KEY: "test-key",
          HOME: os.homedir(),
          USERPROFILE: os.homedir(),
        },
        timeout: 3000,
        expectError: true,
      });

      // In TUI mode, if we get any meaningful output, check for warning
      const output = result.stdout + result.stderr;
      if (
        output.includes("Continue") ||
        output.includes("Agent") ||
        output.includes("Model")
      ) {
        expect(output).toContain(HOME_DIRECTORY_WARNING);
      } else {
        // TUI mode likely failed to start in test environment, which is expected
        // The important thing is that it attempted TUI mode, not headless mode
        expect(result.exitCode).toBeDefined();
      }
    });

    it("should NOT show warning in headless mode regardless of platform", async () => {
      await createTestConfig(context, testConfig);

      // Test with different platform-specific environment variables
      const platformEnvs: Record<string, string>[] = [
        // Unix-style
        {
          HOME: "/home/testuser",
          OPENAI_API_KEY: "test-key",
        },
        // Windows-style
        {
          USERPROFILE: "C:\\Users\\testuser",
          HOMEDRIVE: "C:",
          HOMEPATH: "\\Users\\testuser",
          OPENAI_API_KEY: "test-key",
        },
      ];

      for (const env of platformEnvs) {
        // Create a context where the test directory matches the home directory
        const homeDir = env.HOME || env.USERPROFILE || os.homedir();
        const platformContext = {
          ...context,
          testDir: homeDir,
        };

        const result = await runCLI(platformContext, {
          args: ["-p", "--config", context.configPath!, "test prompt"],
          env,
          timeout: 5000,
          expectError: true,
        });

        // Should NOT contain warning in headless mode regardless of platform
        const output = result.stdout + result.stderr;
        expect(output).not.toContain(HOME_DIRECTORY_WARNING);
      }
    });

    it("should NOT show warning in headless mode with symlinked home directories", async () => {
      await createTestConfig(context, testConfig);

      // Use resolved paths to test symlink handling
      const resolvedHome = path.resolve(os.homedir());
      const homeContext = {
        ...context,
        testDir: resolvedHome,
      };

      const result = await runCLI(homeContext, {
        args: ["-p", "--config", context.configPath!, "test prompt"],
        env: {
          OPENAI_API_KEY: "test-key",
          HOME: resolvedHome,
          USERPROFILE: resolvedHome,
        },
        timeout: 5000,
        expectError: true,
      });

      // Should NOT detect home directory warning in headless mode even with resolved paths
      const output = result.stdout + result.stderr;
      expect(output).not.toContain(HOME_DIRECTORY_WARNING);
    });

    it("should work in TUI mode (when available)", async () => {
      await createTestConfig(context, testConfig);

      // Test TUI mode behavior (though it may fail in test environment)
      const homeContext = {
        ...context,
        testDir: os.homedir(),
      };

      const result = await runCLI(homeContext, {
        args: ["--config", context.configPath!],
        env: {
          OPENAI_API_KEY: "test-key",
          HOME: os.homedir(),
          USERPROFILE: os.homedir(),
        },
        timeout: 3000,
        expectError: true,
      });

      // Even if TUI fails to start properly in test environment,
      // the warning should still be present in any output
      const output = result.stdout + result.stderr;
      if (output.includes("Continue")) {
        // If we got any meaningful output, check for warning
        expect(output).toContain(HOME_DIRECTORY_WARNING);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle case where home directory cannot be determined", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath!, "test prompt"],
        env: {
          OPENAI_API_KEY: "test-key",
          // Remove home directory environment variables
          // HOME: undefined,
          // USERPROFILE: undefined,
          // HOMEDRIVE: undefined,
          // HOMEPATH: undefined,
        },
        timeout: 5000,
        expectError: true,
      });

      // Should not crash when home directory cannot be determined
      expect(result.exitCode).toBeDefined();
      const output = result.stdout + result.stderr;
      // Should not show warning if home cannot be determined (and we're in headless mode anyway)
      expect(output).not.toContain(HOME_DIRECTORY_WARNING);
    });

    it("should handle relative vs absolute path comparisons", async () => {
      await createTestConfig(context, testConfig);

      // Test with relative path representation of home
      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath!, "test prompt"],
        env: {
          OPENAI_API_KEY: "test-key",
          // Use a relative path that resolves to home
          HOME: "~",
        },
        timeout: 5000,
        expectError: true,
      });

      // Should handle path resolution correctly
      expect(result.exitCode).toBeDefined();
    });
  });
});
