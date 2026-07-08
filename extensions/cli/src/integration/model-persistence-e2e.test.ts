import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getModelName, updateModelName } from "../auth/workos.js";
import * as config from "../config.js";
import { ModelService } from "../services/ModelService.js";
import { persistModelName } from "../util/modelPersistence.js";

// Mock the config module
vi.mock("../config.js");

describe("Model Persistence End-to-End", () => {
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
    // Clear persisted model to avoid cross-test contamination
    persistModelName(null);

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

  test("should restore model selection after switch and restart", async () => {
    // Step 1: Persist the model choice via updateModelName (uses GlobalContext)
    updateModelName("Claude 3.5 Sonnet");

    // Verify it was saved
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");

    // Step 2: Create a new service (simulating restart) - should restore persisted model
    const service = new ModelService();
    const state = await service.initialize(mockAssistant, null);

    // Verify the persisted model is restored
    expect(state.model?.name).toBe("Claude 3.5 Sonnet");
    expect(state.model?.provider).toBe("anthropic");
  });

  test("should handle model name mismatch gracefully", async () => {
    // Save a model name that doesn't exist in the assistant
    updateModelName("Non-existent Model");

    const service = new ModelService();
    const state = await service.initialize(mockAssistant, null);

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

    updateModelName("claude-3-5-sonnet-20241022");

    const service = new ModelService();
    const state = await service.initialize(assistantWithModelField, null);

    // Should match by model field
    expect(state.model?.model).toBe("claude-3-5-sonnet-20241022");
  });

  test("should persist model through multiple switches", async () => {
    const service = new ModelService();
    // Clear any persisted model first
    persistModelName(null);
    await service.initialize(mockAssistant, null);

    // Switch to Claude 3.5 Sonnet
    await service.switchModel(1);
    updateModelName("Claude 3.5 Sonnet");
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");

    // Switch to Claude 3 Opus
    await service.switchModel(2);
    updateModelName("Claude 3 Opus");
    expect(getModelName(null)).toBe("Claude 3 Opus");

    // Restart and verify last selection
    const newService = new ModelService();
    const state = await newService.initialize(mockAssistant, null);
    expect(state.model?.name).toBe("Claude 3 Opus");
  });
});
