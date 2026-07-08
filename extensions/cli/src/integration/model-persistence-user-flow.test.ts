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

describe("Model Persistence User Flow", () => {
  let testDir: string;
  let originalContinueHome: string | undefined;
  let mockAssistant: AssistantUnrolled;
  const mockLlmApi = { complete: vi.fn(), stream: vi.fn() };

  beforeEach(async () => {
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

  test("should persist model choice exactly as user experiences it", async () => {
    // Session 1: User starts CLI
    // Auth is always null now (Hub removed)

    // Initialize ModelService (what happens on CLI start)
    const modelService = new ModelService();
    const state = await modelService.initialize(mockAssistant, null);
    expect(state.model?.name).toBe("GPT-4");

    // User switches to Claude 3.5 Sonnet via UI
    await modelService.switchModel(1);
    const modelInfo = modelService.getModelInfo();
    expect(modelInfo?.name).toBe("Claude 3.5 Sonnet");

    // updateModelName persists via GlobalContext
    updateModelName("Claude 3.5 Sonnet");

    // Verify it was saved
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");

    // Session 2: User reopens CLI
    // Initialize ModelService with fresh state (auth is always null)
    const newModelService = new ModelService();
    const newState = await newModelService.initialize(mockAssistant, null);

    // EXPECTATION: Should restore Claude 3.5 Sonnet
    expect(newState.model?.name).toBe("Claude 3.5 Sonnet");
    expect(newState.model?.provider).toBe("anthropic");
  });
});
