import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthenticatedConfig } from "src/auth/workos-types.js";
import { AuthService } from "src/services/AuthService.js";

import {
  getModelName,
  loadAuthConfig,
  saveAuthConfig,
} from "../auth/workos.js";
import * as config from "../config.js";
import { ModelService } from "../services/ModelService.js";

// Mock the config module
vi.mock("../config.js");

describe("Model Persistence User Flow", () => {
  let testDir: string;
  let originalContinueHome: string | undefined;
  let mockAssistant: AssistantUnrolled;
  let mockAuthConfig: AuthenticatedConfig;
  const mockLlmApi = { complete: vi.fn(), stream: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-test-"));
    originalContinueHome = process.env.CONTINUE_GLOBAL_DIR;
    process.env.CONTINUE_GLOBAL_DIR = testDir;

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
      modelName: "GPT-4",
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

  test("should persist model choice exactly as user experiences it", async () => {
    console.log("\n=== SESSION 1: User opens cn and switches model ===");

    // Session 1: User starts CLI
    // Save initial auth config (what happens after login)
    saveAuthConfig(mockAuthConfig);
    console.log("1. Initial auth.json saved");

    // Initialize ModelService (what happens on CLI start)
    const modelService = new ModelService();
    const state = await modelService.initialize(mockAssistant, mockAuthConfig);
    console.log("2. Initial model:", state.model?.name);
    expect(state.model?.name).toBe("GPT-4");

    // User switches to Claude 3.5 Sonnet via UI
    await modelService.switchModel(1);
    const modelInfo = modelService.getModelInfo();
    console.log("3. User switched to:", modelInfo?.name);
    expect(modelInfo?.name).toBe("Claude 3.5 Sonnet");

    // useModelSelector calls updateModelName
    const { updateModelName } = await import("../auth/workos.js");
    const updatedAuthConfig = updateModelName("Claude 3.5 Sonnet");
    console.log("4. Model name persisted to disk");

    // Verify it was saved
    const savedConfig = loadAuthConfig();
    console.log("5. Read back from disk:", getModelName(savedConfig));
    expect(getModelName(savedConfig)).toBe("Claude 3.5 Sonnet");

    // User closes CLI
    console.log("6. User exits CLI\n");

    console.log("=== SESSION 2: User reopens cn ===");

    // Session 2: User restarts CLI
    // Initialize AuthService (loads from disk)
    const authService = new AuthService();
    const authState = await authService.initialize();
    console.log(
      "7. AuthService loaded, modelName in auth:",
      getModelName(authState.authConfig),
    );

    // Initialize ModelService with fresh auth state
    const newModelService = new ModelService();
    const newState = await newModelService.initialize(
      mockAssistant,
      authState.authConfig,
    );
    console.log(
      "8. ModelService initialized with model:",
      newState.model?.name,
    );

    // EXPECTATION: Should restore Claude 3.5 Sonnet
    expect(newState.model?.name).toBe("Claude 3.5 Sonnet");
    expect(newState.model?.provider).toBe("anthropic");
    console.log("✅ Model persisted correctly!\n");
  });
});
