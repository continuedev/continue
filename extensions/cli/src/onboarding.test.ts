import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, expect, test, beforeEach, afterEach } from "vitest";

import type { AuthConfig } from "./auth/workos.js";
import { runNormalFlow } from "./onboarding.js";

describe("onboarding config flag handling", () => {
  let tempDir: string;
  let mockAuthConfig: AuthConfig;

  beforeEach(() => {
    // Create a temporary directory for test config files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-test-"));

    // Create a minimal auth config for testing
    mockAuthConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: "test-org",
    };
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("should fail loudly when --config points to non-existent file", async () => {
    const configPath = path.join(tempDir, "non-existent.yaml");

    // Verify the file doesn't exist
    expect(fs.existsSync(configPath)).toBe(false);

    // Should throw an error that mentions both the path and the failure
    await expect(runNormalFlow(mockAuthConfig, configPath)).rejects.toThrow(
      /Failed to load config from ".*non-existent\.yaml": .*ENOENT/,
    );
  });

  test("should fail loudly when --config points to malformed YAML file", async () => {
    const configPath = path.join(tempDir, "malformed.yaml");

    // Create a malformed YAML file
    fs.writeFileSync(
      configPath,
      `
name: "Test Config"
models:
  - name: "GPT-4"
    provider: "openai"
    invalid_yaml_syntax: [unclosed array
`,
    );

    // Verify the file exists
    expect(fs.existsSync(configPath)).toBe(true);

    // Should throw an error mentioning the path and failure to load
    await expect(runNormalFlow(mockAuthConfig, configPath)).rejects.toThrow(
      /Failed to load config from ".*malformed\.yaml": .+/,
    );
  });

  test("should fail loudly when --config points to file with missing required fields", async () => {
    const configPath = path.join(tempDir, "incomplete.yaml");

    // Create a config file missing required fields
    fs.writeFileSync(
      configPath,
      `
name: "Incomplete Config"
# Missing models array and other required fields
`,
    );

    // Verify the file exists
    expect(fs.existsSync(configPath)).toBe(true);

    // Should throw with our specific error format and include path
    await expect(runNormalFlow(mockAuthConfig, configPath)).rejects.toThrow(
      /^Failed to load config from ".*": .+/,
    );
  });

  test("should handle different config path formats with proper error messages", async () => {
    const testPaths = [
      "./non-existent.yaml",
      "/absolute/path/config.yaml",
      "../relative/config.yaml",
      "simple-name.yaml",
    ];

    for (const configPath of testPaths) {
      await expect(runNormalFlow(mockAuthConfig, configPath)).rejects.toThrow(
        /Failed to load config from ".*": .+/,
      );
    }
  });

  test("should handle empty string config path", async () => {
    // Empty string should be treated differently from undefined
    // Note: empty string triggers onboarding flow, but should still fail in our error format
    await expect(runNormalFlow(mockAuthConfig, "")).rejects.toThrow();
  });

  test("should not fall back to default config when explicit config fails", async () => {
    const configPath = path.join(tempDir, "bad-config.yaml");

    // Create a bad config file
    fs.writeFileSync(configPath, "invalid: yaml: content: [");

    const promise = runNormalFlow(mockAuthConfig, configPath);

    await expect(promise).rejects.toThrow();

    try {
      await promise;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // CRITICAL: Must have our specific error format from the fix
      expect(message).toMatch(/^Failed to load config from ".*": .+/);

      // Error should be about the specific config file we provided
      expect(message).toContain(configPath);

      // Should NOT mention falling back to default config (this was the bug!)
      expect(message).not.toContain("~/.continue/config.yaml");
      expect(message).not.toContain("default config");
      expect(message).not.toContain("fallback");
    }
  });

  test("demonstrates the fix: explicit config failure vs no config provided", async () => {
    const badConfigPath = path.join(tempDir, "bad.yaml");
    fs.writeFileSync(badConfigPath, "invalid yaml [");

    // Case 1: Explicit --config that fails should throw our specific error
    await expect(runNormalFlow(mockAuthConfig, badConfigPath)).rejects.toThrow(
      /^Failed to load config from "/,
    );

    // Case 2: No explicit config should follow different logic
    try {
      await runNormalFlow(mockAuthConfig, undefined);
      // If it succeeds, that's fine - the point is it's different behavior
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // This should NOT have our "Failed to load config from" prefix
      expect(errorMessage).not.toMatch(/^Failed to load config from "/);
    }
  });
});
