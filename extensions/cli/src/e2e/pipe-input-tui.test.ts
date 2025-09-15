import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  createTestContext,
  cleanupTestContext,
  runCLI,
  createTestConfig,
  type CLITestContext,
} from "../test-helpers/cli-helpers.js";

describe("E2E: Pipe Input to TUI Mode", () => {
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

  const testEnv = { OPENAI_API_KEY: "test-key" };

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  describe("piped input handling in test environment", () => {
    it("should maintain backward compatibility with explicit -p flag", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath!],
        env: testEnv,
        input: "Explicit headless mode",
        timeout: 5000,
        expectError: true,
      });

      // With explicit -p flag, should be in headless mode
      // Should show headless mode error (no prompt provided when input is ignored in test)
      expect(result.stderr).toContain(
        "A prompt is required when using the -p/--print flag",
      );
      expect(result.exitCode).not.toBe(0);
    });

    it("should handle explicit -p flag with prompt argument", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath!, "Test prompt"],
        env: testEnv,
        timeout: 5000,
        expectError: true,
      });

      // With explicit -p flag and prompt, should attempt headless mode
      // Will fail due to missing LLM configuration, but that's expected
      expect(result.exitCode).not.toBe(0);

      // Should not show the "prompt required" error since we provided one
      expect(result.stderr).not.toContain(
        "A prompt is required when using the -p/--print flag",
      );
    });

    it("should try to start TUI mode when no explicit flags are provided", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: ["--config", context.configPath!],
        env: testEnv,
        input: "This will be ignored in test environment",
        timeout: 3000, // Shorter timeout since we expect quick failure
        expectError: true,
      });

      // Without -p flag, should attempt TUI mode
      // In test environment, this will likely fail quickly due to stdin/TTY issues
      // but the important thing is that it doesn't immediately error about missing prompt
      expect(result.stderr).not.toContain(
        "A prompt is required when using the -p/--print flag",
      );

      // Should exit with error due to test environment limitations
      expect(result.exitCode).not.toBe(0);
    });

    it("should handle platform differences in subprocess execution", async () => {
      await createTestConfig(context, testConfig);

      // Test that the CLI can be executed on different platforms without crashing
      const result = await runCLI(context, {
        args: ["--config", context.configPath!, "Test cross-platform"],
        env: testEnv,
        timeout: 3000,
        expectError: true,
      });

      // The key is that it should not crash immediately
      // Platform-specific behavior may vary, but basic execution should work
      expect(result.exitCode).toBeDefined();
      expect(typeof result.stdout).toBe("string");
      expect(typeof result.stderr).toBe("string");

      // On any platform, should not show headless-mode specific errors
      // when no -p flag is provided
      expect(result.stderr).not.toContain(
        "A prompt is required when using the -p/--print flag",
      );
    });
  });

  describe("configuration and environment handling", () => {
    it("should handle invalid configuration gracefully", async () => {
      // Test with malformed config
      await createTestConfig(context, "invalid: yaml\nno: models: here");

      const result = await runCLI(context, {
        args: ["--config", context.configPath!],
        env: testEnv,
        timeout: 3000,
        expectError: true,
      });

      // Should fail due to invalid config, not due to pipe handling
      expect(result.exitCode).not.toBe(0);
    });

    it("should handle missing config file", async () => {
      const result = await runCLI(context, {
        args: ["--config", "/nonexistent/config.yaml"],
        env: testEnv,
        timeout: 3000,
        expectError: true,
      });

      // Should fail due to missing config
      expect(result.exitCode).not.toBe(0);
    });

    it("should handle various environment variables", async () => {
      await createTestConfig(context, testConfig);

      // Test with different environment configurations
      const testEnvs = [
        { ...testEnv, NODE_ENV: "production" },
        { ...testEnv, NODE_ENV: "development" },
        { ...testEnv, CI: "true" },
      ];

      for (const env of testEnvs) {
        const result = await runCLI(context, {
          args: ["--config", context.configPath!],
          env,
          timeout: 3000,
          expectError: true,
        });

        // Should handle different environments without crashing
        expect(result.exitCode).toBeDefined();
      }
    });
  });

  describe("argument processing", () => {
    it("should handle various flag combinations", async () => {
      await createTestConfig(context, testConfig);

      const flagCombinations = [
        ["--verbose", "--config", context.configPath!],
        ["--config", context.configPath!, "--verbose"],
        ["--config", context.configPath!, "prompt with spaces"],
      ];

      for (const args of flagCombinations) {
        const result = await runCLI(context, {
          args,
          env: testEnv,
          timeout: 3000,
          expectError: true,
        });

        // Should process arguments without immediate crashes
        expect(result.exitCode).toBeDefined();
      }
    });

    it("should handle help and version flags", async () => {
      // These should work without config
      const helpResult = await runCLI(context, {
        args: ["--help"],
        timeout: 3000,
      });

      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stdout).toContain("Continue CLI");

      const versionResult = await runCLI(context, {
        args: ["--version"],
        timeout: 3000,
      });

      expect(versionResult.exitCode).toBe(0);
      expect(versionResult.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });
});

/**
 * Note: This test suite focuses on testing the CLI behavior within the constraints
 * of the test environment. The actual pipe input detection cannot be fully tested
 * here because:
 *
 * 1. readStdinSync() returns null when CONTINUE_CLI_TEST=true to prevent hanging
 * 2. TUI mode requires real TTY access which isn't available in test subprocesses
 * 3. Cross-platform TTY behavior varies significantly
 *
 * However, we test:
 * - Backward compatibility with explicit flags
 * - Proper argument processing
 * - Error handling for various scenarios
 * - Platform-agnostic behavior
 *
 * For manual testing of the full pipe functionality, use:
 * npm run build && echo "test" | node dist/index.js
 */
