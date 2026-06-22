import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

<<<<<<< HEAD
import {
  getModelName,
  loadAuthConfig,
  updateModelName,
} from "../auth/workos.js";
=======
import { getModelName, updateModelName } from "../auth/workos.js";
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import * as config from "../config.js";
import { ModelService } from "../services/ModelService.js";
import {
  getPersistedModelName,
  persistModelName,
} from "../util/modelPersistence.js";

// Mock the config module
vi.mock("../config.js");

<<<<<<< HEAD
describe("Model Persistence for Unauthenticated Users", () => {
=======
describe("Model Persistence (Hub auth removed)", () => {
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  let testDir: string;
  let originalContinueHome: string | undefined;
  let mockAssistant: AssistantUnrolled;
  const mockLlmApi = { complete: vi.fn(), stream: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-test-"));
    originalContinueHome = process.env.CONTINUE_GLOBAL_DIR;
    process.env.CONTINUE_GLOBAL_DIR = testDir;

    // Clear GlobalContext for clean test state
    persistModelName(null);

    mockAssistant = {
      name: "test-assistant",
      version: "1.0.0",
      models: [
        {
          provider: "openai",
          model: "gpt-4",
          name: "GPT-4",
          apiKey: "test-key",
          roles: ["chat"],
        } as ModelConfig,
        {
          provider: "anthropic",
          model: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          apiKey: "test-key",
          roles: ["chat"],
        } as ModelConfig,
        {
          provider: "anthropic",
          model: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          apiKey: "test-key",
          roles: ["chat"],
        } as ModelConfig,
      ],
    } as AssistantUnrolled;

    // Setup default mock behavior
    vi.mocked(config.getLlmApi).mockReturnValue([
      mockLlmApi as any,
      mockAssistant.models![0] as ModelConfig,
    ]);
    vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);
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

<<<<<<< HEAD
  test("should persist model selection for logged-out users", () => {
    // User is logged out (no auth config)
    const authConfig = loadAuthConfig();
    expect(authConfig).toBeNull();

    // User switches model
=======
  test("should persist model selection via GlobalContext", () => {
    // Auth is always null now
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    updateModelName("Claude 3.5 Sonnet");

    // Verify it was saved to GlobalContext
    const persistedModel = getPersistedModelName();
    expect(persistedModel).toBe("Claude 3.5 Sonnet");

    // Verify getModelName returns it for null config
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");
  });

<<<<<<< HEAD
  test("should restore model selection on next session for logged-out users", async () => {
    // Session 1: User is logged out and switches model
    const authConfig = loadAuthConfig();
    expect(authConfig).toBeNull();

    const modelService = new ModelService();
    await modelService.initialize(mockAssistant, authConfig);
=======
  test("should restore model selection on next session", async () => {
    // Session 1: User switches model
    const modelService = new ModelService();
    await modelService.initialize(mockAssistant, null);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

    await modelService.switchModel(1);
    updateModelName("Claude 3.5 Sonnet");

<<<<<<< HEAD
    // Session 2: User reopens CLI (still logged out)
    const newAuthConfig = loadAuthConfig();
    expect(newAuthConfig).toBeNull();

    const newModelService = new ModelService();
    const state = await newModelService.initialize(
      mockAssistant,
      newAuthConfig,
    );
=======
    // Session 2: User reopens CLI
    const newModelService = new ModelService();
    const state = await newModelService.initialize(mockAssistant, null);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

    // Should restore Claude 3.5 Sonnet
    expect(state.model?.name).toBe("Claude 3.5 Sonnet");
  });

<<<<<<< HEAD
  test("should handle multiple model switches for logged-out users", () => {
    updateModelName("GPT-4");
    expect(getModelName(null)).toBe("GPT-4");

    updateModelName("Claude 3.5 Sonnet");
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");

=======
  test("should handle multiple model switches and persist last one", () => {
    // Perform multiple switches - only verify the final state
    // to avoid race conditions with concurrent test files using the same GlobalContext
    updateModelName("GPT-4");
    updateModelName("Claude 3.5 Sonnet");
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    updateModelName("Claude 3 Opus");
    expect(getModelName(null)).toBe("Claude 3 Opus");
  });

  test("should clear model selection when set to null", () => {
    updateModelName("Claude 3.5 Sonnet");
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");

    updateModelName(null);
    expect(getModelName(null)).toBeNull();
  });

<<<<<<< HEAD
  test("should preserve GlobalContext model when user logs in", () => {
    // User is logged out with a persisted model
    updateModelName("Claude 3.5 Sonnet");
    expect(getPersistedModelName()).toBe("Claude 3.5 Sonnet");

    // User logs in (simulated by having auth.json)
    const authPath = path.join(testDir, "auth.json");
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        userId: "test-user",
        userEmail: "test@example.com",
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: Date.now() + 3600000,
        organizationId: "test-org",
      }),
    );

    const authConfig = loadAuthConfig();
    expect(authConfig).not.toBeNull();

    // GlobalContext model should still exist
    expect(getPersistedModelName()).toBe("Claude 3.5 Sonnet");

    // When auth config has no modelName, it should fall back to GlobalContext
    expect(getModelName(authConfig)).toBe("Claude 3.5 Sonnet");
  });

  test("should use auth config model when both exist", () => {
    // Clear previous state
    updateModelName(null);

    // Set GlobalContext model
    updateModelName("GPT-4");
    expect(getPersistedModelName()).toBe("GPT-4");

    // Create auth config with different model
    const authPath = path.join(testDir, "auth.json");
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        userId: "test-user",
        userEmail: "test@example.com",
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAt: Date.now() + 3600000,
        organizationId: "test-org",
        modelName: "Claude 3.5 Sonnet",
      }),
    );

    const authConfig = loadAuthConfig();

    // Auth config should take precedence
    expect(getModelName(authConfig)).toBe("Claude 3.5 Sonnet");
  });

  test("should not save to GlobalContext when using CONTINUE_API_KEY", () => {
    // Clear any existing model
    updateModelName(null);
    expect(getPersistedModelName()).toBeNull();

    // Capture original value to restore after test
    const originalApiKey = process.env.CONTINUE_API_KEY;
    process.env.CONTINUE_API_KEY = "test-api-key";

    updateModelName("Claude 3.5 Sonnet");

    // Should not be saved to GlobalContext
    expect(getPersistedModelName()).toBeNull();

    // Restore original value
    if (originalApiKey === undefined) {
      delete process.env.CONTINUE_API_KEY;
    } else {
      process.env.CONTINUE_API_KEY = originalApiKey;
    }
  });

  test("should work across config changes for logged-out users", async () => {
=======
  test("should work across config changes", async () => {
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    // User switches model with one config
    updateModelName("Claude 3.5 Sonnet");

    const modelService = new ModelService();
    let state = await modelService.initialize(mockAssistant, null);
    expect(state.model?.name).toBe("Claude 3.5 Sonnet");

    // User switches to a different model
    await modelService.switchModel(2);
    updateModelName("Claude 3 Opus");

    // Create new service (simulating restart)
    const newModelService = new ModelService();
    state = await newModelService.initialize(mockAssistant, null);
    expect(state.model?.name).toBe("Claude 3 Opus");
  });
});
