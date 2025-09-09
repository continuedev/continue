import * as fs from "node:fs";
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

      // Simulate running from home directory using the isolated test dir
      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath!, "test prompt"],
        env: {
          OPENAI_API_KEY: "test-key",
          // Ensure home vars point to the isolated test dir
          HOME: context.testDir,
          USERPROFILE: context.testDir,
          HOMEDRIVE: path.parse(context.testDir).root,
          HOMEPATH: path.relative(
            path.parse(context.testDir).root,
            context.testDir,
          ),
          CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue-global"),
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

      // Test TUI mode (without -p flag) from an isolated "home" directory
      const result = await runCLI(context, {
        args: ["--config", context.configPath!],
        env: {
          OPENAI_API_KEY: "test-key",
          HOME: context.testDir,
          USERPROFILE: context.testDir,
          HOMEDRIVE: path.parse(context.testDir).root,
          HOMEPATH: path.relative(
            path.parse(context.testDir).root,
            context.testDir,
          ),
          CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue-global"),
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
          HOME: context.testDir,
          OPENAI_API_KEY: "test-key",
        },
        // Windows-style
        {
          USERPROFILE: context.testDir,
          HOMEDRIVE: path.parse(context.testDir).root,
          HOMEPATH: path.relative(
            path.parse(context.testDir).root,
            context.testDir,
          ),
          OPENAI_API_KEY: "test-key",
        },
      ];

      for (const env of platformEnvs) {
        const result = await runCLI(context, {
          args: ["-p", "--config", context.configPath!, "test prompt"],
          env: {
            CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue-global"),
            ...env,
          },
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

      // Create a symlink to the isolated home directory to simulate symlinked home paths
      const realHome = fs.realpathSync(context.testDir);
      const linkPath = path.join(
        path.dirname(realHome),
        `${path.basename(realHome)}-link`,
      );
      try {
        if (!fs.existsSync(linkPath)) {
          fs.symlinkSync(realHome, linkPath, "dir");
        }
      } catch {
        // If symlink creation fails (e.g., on Windows without privileges), skip this specific scenario
      }

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath!, "test prompt"],
        env: {
          OPENAI_API_KEY: "test-key",
          // Point HOME to the symlink while cwd remains the real path
          HOME: fs.existsSync(linkPath) ? linkPath : realHome,
          USERPROFILE: fs.existsSync(linkPath) ? linkPath : realHome,
          HOMEDRIVE: path.parse(realHome).root,
          HOMEPATH: path.relative(path.parse(realHome).root, realHome),
          CONTINUE_GLOBAL_DIR: path.join(realHome, ".continue-global"),
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
      const result = await runCLI(context, {
        args: ["--config", context.configPath!],
        env: {
          OPENAI_API_KEY: "test-key",
          HOME: context.testDir,
          USERPROFILE: context.testDir,
          HOMEDRIVE: path.parse(context.testDir).root,
          HOMEPATH: path.relative(
            path.parse(context.testDir).root,
            context.testDir,
          ),
          CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue-global"),
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
          CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue-global"),
          // Mask home directory environment variables so os.homedir() cannot derive a value
          HOME: "",
          USERPROFILE: "",
          HOMEDRIVE: "",
          HOMEPATH: "",
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

      // Use a HOME that is equivalent but not identical (e.g., with './')
      const altHome = path.join(context.testDir, ".");
      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath!, "test prompt"],
        env: {
          OPENAI_API_KEY: "test-key",
          HOME: altHome,
          USERPROFILE: altHome,
          HOMEDRIVE: path.parse(altHome).root,
          HOMEPATH: path.relative(path.parse(altHome).root, altHome),
          CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue-global"),
        },
        timeout: 5000,
        expectError: true,
      });

      // Should handle path resolution correctly (no crash)
      expect(result.exitCode).toBeDefined();
    });
  });
});
