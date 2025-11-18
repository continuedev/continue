import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AuthenticatedConfig } from "src/auth/workos-types.js";

import {
  getModelName,
  loadAuthConfig,
  saveAuthConfig,
  updateModelName,
} from "../auth/workos.js";
import { persistModelName } from "../util/modelPersistence.js";

describe("Model Persistence Integration", () => {
  let testDir: string;
  let originalContinueHome: string | undefined;

  beforeEach(() => {
    // Create a temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-test-"));
    originalContinueHome = process.env.CONTINUE_GLOBAL_DIR;
    process.env.CONTINUE_GLOBAL_DIR = testDir;

    // Clear GlobalContext for clean test state
    persistModelName(null);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    if (originalContinueHome) {
      process.env.CONTINUE_GLOBAL_DIR = originalContinueHome;
    } else {
      delete process.env.CONTINUE_GLOBAL_DIR;
    }
  });

  test("should persist model name when user selects a model", () => {
    // Create initial auth config without model name
    const authConfig: AuthenticatedConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: "test-org",
    };

    saveAuthConfig(authConfig);

    // User selects a model
    updateModelName("Claude 3.5 Sonnet");

    // Load config and verify model name is persisted
    const loadedConfig = loadAuthConfig();
    expect(getModelName(loadedConfig)).toBe("Claude 3.5 Sonnet");
  });

  test("should update model name when user switches models", () => {
    // Create initial auth config with a model
    const authConfig: AuthenticatedConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: "test-org",
      modelName: "GPT-4",
    };

    saveAuthConfig(authConfig);

    // User switches to a different model
    updateModelName("Claude 3.5 Sonnet");

    // Load config and verify new model name
    const loadedConfig = loadAuthConfig();
    expect(getModelName(loadedConfig)).toBe("Claude 3.5 Sonnet");
  });

  test("should preserve other auth config fields when updating model", () => {
    // Create initial auth config
    const authConfig: AuthenticatedConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: "test-org",
      configUri: "slug://owner/my-config",
    };

    saveAuthConfig(authConfig);

    // Update model name
    updateModelName("Claude 3.5 Sonnet");

    // Load config and verify all fields are preserved
    const loadedConfig = loadAuthConfig();
    expect(loadedConfig).toMatchObject({
      userId: "test-user",
      userEmail: "test@example.com",
      organizationId: "test-org",
      configUri: "slug://owner/my-config",
      modelName: "Claude 3.5 Sonnet",
    });
  });

  test("should clear model name when set to null", () => {
    // Create initial auth config with a model
    const authConfig: AuthenticatedConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: "test-org",
      modelName: "GPT-4",
    };

    saveAuthConfig(authConfig);

    // Clear model name
    updateModelName(null);

    // Load config and verify model name is cleared
    const loadedConfig = loadAuthConfig();
    expect(getModelName(loadedConfig)).toBeNull();
  });

  test("should return null for model name when not authenticated and no GlobalContext", () => {
    // No auth config exists and no GlobalContext model
    persistModelName(null); // Ensure GlobalContext is clear
    const loadedConfig = loadAuthConfig();
    expect(getModelName(loadedConfig)).toBeNull();
  });

  test("should not persist model name when using CONTINUE_API_KEY", () => {
    // Clear GlobalContext first
    persistModelName(null);

    // Capture original value to restore after test
    const originalApiKey = process.env.CONTINUE_API_KEY;
    // Set environment variable
    process.env.CONTINUE_API_KEY = "test-api-key";

    // Try to update model name
    updateModelName("Claude 3.5 Sonnet");

    // Load config - should be environment auth config without model name
    const loadedConfig = loadAuthConfig();
    expect(getModelName(loadedConfig)).toBeNull();

    // Restore original value
    if (originalApiKey === undefined) {
      delete process.env.CONTINUE_API_KEY;
    } else {
      process.env.CONTINUE_API_KEY = originalApiKey;
    }
  });

  test("should persist model name in auth.json file with correct format", () => {
    // Create and save auth config
    const authConfig: AuthenticatedConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: "test-org",
    };

    saveAuthConfig(authConfig);
    updateModelName("Claude 3.5 Sonnet");

    // Read the raw file content
    const authPath = path.join(testDir, "auth.json");
    const rawContent = fs.readFileSync(authPath, "utf8");
    const parsedContent = JSON.parse(rawContent);

    // Verify the file structure
    expect(parsedContent).toHaveProperty("userId", "test-user");
    expect(parsedContent).toHaveProperty("userEmail", "test@example.com");
    expect(parsedContent).toHaveProperty("organizationId", "test-org");
    expect(parsedContent).toHaveProperty("modelName", "Claude 3.5 Sonnet");

    // Verify it's pretty-printed (has indentation)
    expect(rawContent).toContain("\n  ");
  });
});
