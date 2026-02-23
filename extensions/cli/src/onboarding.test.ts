import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { AuthConfig } from "./auth/workos.js";
import { initializeWithOnboarding } from "./onboarding.js";

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
    await expect(
      initializeWithOnboarding(mockAuthConfig, configPath),
    ).rejects.toThrow(
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
    await expect(
      initializeWithOnboarding(mockAuthConfig, configPath),
    ).rejects.toThrow(/Failed to load config from ".*malformed\.yaml": .+/);
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
    await expect(
      initializeWithOnboarding(mockAuthConfig, configPath),
    ).rejects.toThrow(/^Failed to load config from ".*": .+/);
  });

  test("should handle different config path formats with proper error messages", async () => {
    const testPaths = [
      "./non-existent.yaml",
      "/absolute/path/config.yaml",
      "../relative/config.yaml",
      "simple-name.yaml",
    ];

    for (const configPath of testPaths) {
      await expect(
        initializeWithOnboarding(mockAuthConfig, configPath),
      ).rejects.toThrow(/Failed to load config from ".*": .+/);
    }
  });

  test("should handle empty string config path", async () => {
    // Loads default agent with no error
    await initializeWithOnboarding(mockAuthConfig, "");
  });

  test("should not fall back to default config when explicit config fails", async () => {
    const configPath = path.join(tempDir, "bad-config.yaml");

    // Create a bad config file
    fs.writeFileSync(configPath, "invalid: yaml: content: [");

    const promise = initializeWithOnboarding(mockAuthConfig, configPath);

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
    await expect(
      initializeWithOnboarding(mockAuthConfig, badConfigPath),
    ).rejects.toThrow(/^Failed to load config from "/);

    // Case 2: No explicit config should follow different logic
    try {
      await initializeWithOnboarding(mockAuthConfig, undefined);
      // If it succeeds, that's fine - the point is it's different behavior
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // This should NOT have our "Failed to load config from" prefix
      expect(errorMessage).not.toMatch(/^Failed to load config from "/);
    }
  });
});

// Separate describe block with its own mocking for BEDROCK tests
describe("CONTINUE_USE_BEDROCK environment variable", () => {
  const mockConsoleLog = vi.fn();
  let mockAuthConfig: AuthConfig;
  const originalEnv = process.env.CONTINUE_USE_BEDROCK;

  // Mock initialize for these tests only
  const mockInitialize = vi.fn().mockResolvedValue({
    config: { name: "test-config", models: [], rules: [] },
    llmApi: {},
    model: { name: "test-model" },
    mcpService: {},
    apiClient: {},
  });

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockInitialize.mockClear();

    // Spy on console.log for these tests
    vi.spyOn(console, "log").mockImplementation(mockConsoleLog);

    // Mock the config module
    vi.doMock("./config.js", () => ({ initialize: mockInitialize }));

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
    if (originalEnv) {
      process.env.CONTINUE_USE_BEDROCK = originalEnv;
    } else {
      delete process.env.CONTINUE_USE_BEDROCK;
    }
    vi.restoreAllMocks();
    vi.doUnmock("./config.js");
  });

  test("should bypass interactive options when CONTINUE_USE_BEDROCK=1", async () => {
    process.env.CONTINUE_USE_BEDROCK = "1";

    // Re-import to get the mocked version
    vi.resetModules();
    const { runOnboardingFlow } = await import("./onboarding.js");

    const result = await runOnboardingFlow(undefined);

    expect(result).toBe(true);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        "✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)",
      ),
    );
  });

  test("should not bypass when CONTINUE_USE_BEDROCK is not '1'", async () => {
    process.env.CONTINUE_USE_BEDROCK = "0";

    // Re-import to get the mocked version
    vi.resetModules();
    const { runOnboardingFlow } = await import("./onboarding.js");

    // Mock non-interactive environment to avoid hanging
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;

    try {
      await runOnboardingFlow(undefined);

      // Verify the Bedrock message was NOT called by checking all calls
      const allCalls = mockConsoleLog.mock.calls.flat();
      const hasBedrockMessage = allCalls.some((call) =>
        String(call).includes(
          "✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)",
        ),
      );
      expect(hasBedrockMessage).toBe(false);
    } finally {
      process.stdin.isTTY = originalIsTTY;
    }
  });
});
