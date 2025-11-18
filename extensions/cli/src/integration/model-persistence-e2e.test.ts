import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthenticatedConfig } from "src/auth/workos-types.js";

import {
  getModelName,
  loadAuthConfig,
  saveAuthConfig,
  updateModelName,
} from "../auth/workos.js";
import * as config from "../config.js";
import { ModelService } from "../services/ModelService.js";
import { persistModelName } from "../util/modelPersistence.js";

// Mock the config module
vi.mock("../config.js");

describe("Model Persistence End-to-End", () => {
  let testDir: string;
  let originalContinueHome: string | undefined;
  let mockAssistant: AssistantUnrolled;
  let mockAuthConfig: AuthenticatedConfig;
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

    mockAuthConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000, // 1 hour from now
      organizationId: "test-org",
    };

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

  test("should restore model selection after restart", async () => {
    // Step 1: Initial session - user starts with default model (GPT-4)
    saveAuthConfig(mockAuthConfig);
    let service = new ModelService();
    let state = await service.initialize(mockAssistant, mockAuthConfig);

    console.log("Initial model:", state.model?.name);
    expect(state.model?.name).toBe("GPT-4");

    // Step 2: User switches to Claude 3.5 Sonnet (index 1)
    await service.switchModel(1);
    state = service.getState();

    console.log("After switch:", state.model?.name);
    expect(state.model?.name).toBe("Claude 3.5 Sonnet");

    // Step 3: Persist the model choice (this should happen in useModelSelector)
    updateModelName("Claude 3.5 Sonnet");

    // Verify it was saved to auth.json
    const savedConfig = loadAuthConfig();
    console.log("Saved model name:", getModelName(savedConfig));
    expect(getModelName(savedConfig)).toBe("Claude 3.5 Sonnet");

    // Step 4: Simulate restart - create new service instance
    // Load fresh auth config from disk (this is what the real code does)
    const freshAuthConfig = loadAuthConfig();
    console.log("Fresh auth config model name:", getModelName(freshAuthConfig));

    service = new ModelService();
    state = await service.initialize(mockAssistant, freshAuthConfig);

    // Step 5: Verify the persisted model is restored
    console.log("After restart:", state.model?.name);
    expect(state.model?.name).toBe("Claude 3.5 Sonnet");
    expect(state.model?.provider).toBe("anthropic");
  });

  test("should handle model name mismatch gracefully", async () => {
    // Save auth config with a model that doesn't exist
    mockAuthConfig.modelName = "Non-existent Model";
    saveAuthConfig(mockAuthConfig);

    const service = new ModelService();
    const state = await service.initialize(mockAssistant, mockAuthConfig);

    // Should fall back to first available model (GPT-4)
    expect(state.model?.name).toBe("GPT-4");
  });

  test("should check both name and model fields when matching", async () => {
    // Some configs might have model field instead of name
    const assistantWithModelField = {
      ...mockAssistant,
      models: [
        {
          provider: "openai",
          model: "gpt-4",
          // No name field, just model
          apiKey: "test-key",
          roles: ["chat"],
        } as ModelConfig,
        {
          provider: "anthropic",
          model: "claude-3-5-sonnet-20241022",
          // No name field, just model
          apiKey: "test-key",
          roles: ["chat"],
        } as ModelConfig,
      ],
    } as AssistantUnrolled;

    mockAuthConfig.modelName = "claude-3-5-sonnet-20241022";
    saveAuthConfig(mockAuthConfig);

    const service = new ModelService();
    const state = await service.initialize(
      assistantWithModelField,
      mockAuthConfig,
    );

    // Should match by model field
    expect(state.model?.model).toBe("claude-3-5-sonnet-20241022");
  });

  test("should persist model through multiple switches", async () => {
    saveAuthConfig(mockAuthConfig);
    const service = new ModelService();
    await service.initialize(mockAssistant, mockAuthConfig);

    // Switch to Claude 3.5 Sonnet
    await service.switchModel(1);
    updateModelName("Claude 3.5 Sonnet");
    expect(getModelName(loadAuthConfig())).toBe("Claude 3.5 Sonnet");

    // Switch to Claude 3 Opus
    await service.switchModel(2);
    updateModelName("Claude 3 Opus");
    expect(getModelName(loadAuthConfig())).toBe("Claude 3 Opus");

    // Restart and verify last selection
    const freshAuthConfig = loadAuthConfig();
    console.log("Fresh auth config model name:", getModelName(freshAuthConfig));

    const newService = new ModelService();
    const state = await newService.initialize(mockAssistant, freshAuthConfig);
    expect(state.model?.name).toBe("Claude 3 Opus");
  });
});
