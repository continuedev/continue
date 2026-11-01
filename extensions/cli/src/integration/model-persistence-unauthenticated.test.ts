import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getModelName, updateModelName } from "../auth/workos.js";
import * as config from "../config.js";
import { ModelService } from "../services/ModelService.js";
import {
  getPersistedModelName,
  persistModelName,
} from "../util/modelPersistence.js";

// Mock the config module
vi.mock("../config.js");

describe("Model Persistence (Hub auth removed)", () => {
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

  test("should persist model selection via GlobalContext", () => {
    // Auth is always null now
    updateModelName("Claude 3.5 Sonnet");

    // Verify it was saved to GlobalContext
    const persistedModel = getPersistedModelName();
    expect(persistedModel).toBe("Claude 3.5 Sonnet");

    // Verify getModelName returns it for null config
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");
  });

  test("should restore model selection on next session", async () => {
    // Session 1: User switches model
    const modelService = new ModelService();
    await modelService.initialize(mockAssistant, null);

    await modelService.switchModel(1);
    updateModelName("Claude 3.5 Sonnet");

    // Session 2: User reopens CLI
    const newModelService = new ModelService();
    const state = await newModelService.initialize(mockAssistant, null);

    // Should restore Claude 3.5 Sonnet
    expect(state.model?.name).toBe("Claude 3.5 Sonnet");
  });

  test("should handle multiple model switches and persist last one", () => {
    // Perform multiple switches - only verify the final state
    // to avoid race conditions with concurrent test files using the same GlobalContext
    updateModelName("GPT-4");
    updateModelName("Claude 3.5 Sonnet");
    updateModelName("Claude 3 Opus");
    expect(getModelName(null)).toBe("Claude 3 Opus");
  });

  test("should clear model selection when set to null", () => {
    updateModelName("Claude 3.5 Sonnet");
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");

    updateModelName(null);
    expect(getModelName(null)).toBeNull();
  });

  test("should work across config changes", async () => {
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
