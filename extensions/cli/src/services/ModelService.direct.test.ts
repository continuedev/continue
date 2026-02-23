import { describe, it, expect, beforeEach } from "vitest";

import { ModelService } from "./ModelService.js";

describe("ModelService - Direct Testing", () => {
  let modelService: ModelService;

  beforeEach(() => {
    modelService = new ModelService();
  });

  it("should throw 'ModelService not initialized' when switching without initialization", async () => {
    // The service is created but not initialized (no assistant or authConfig)
    expect(modelService.getCurrentModelIndex()).toBe(-1);

    // Try to switch model without initialization
    try {
      await modelService.switchModel(0);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should throw the specific error
      expect(error.message).toBe(
        "ModelService not initialized - assistant data missing",
      );
    }
  });

  it("should handle model switching with null authConfig for non-proxy models", async () => {
    // Initialize the service properly
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "claude-3.5-sonnet",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
          apiKey: "test-anthropic-key",
          roles: ["chat"],
        },
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-openai-key",
          roles: ["chat"],
        },
      ],
    };

    // Initialize with null authConfig - valid for non-proxy models
    const initialState = await modelService.initialize(
      mockAssistant as any,
      null as any,
    );

    // Verify initialization succeeded with null authConfig
    expect(initialState.assistant).toBe(mockAssistant);
    expect(initialState.authConfig).toBe(null);
    expect(initialState.model).toBeDefined();
    expect((initialState.model as any).name).toBe("claude-3.5-sonnet");

    // Should be able to switch models even with null authConfig
    const switchedState = await modelService.switchModel(1);
    expect(switchedState.model).toBeDefined();
    expect((switchedState.model as any).name).toBe("GPT-4");
    expect(switchedState.assistant).toBe(mockAssistant);
    expect(switchedState.authConfig).toBe(null);

    // Verify the model info
    const modelInfo = modelService.getModelInfo();
    expect(modelInfo?.name).toBe("GPT-4");
    expect(modelInfo?.provider).toBe("openai");
  });

  it("should successfully switch model after proper initialization", async () => {
    // Initialize the service properly
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-key-1",
          roles: ["chat"],
        },
        {
          name: "GPT-3.5",
          provider: "openai",
          model: "gpt-3.5-turbo",
          apiKey: "test-key-2",
          roles: ["chat"],
        },
      ],
    };

    const mockAuthConfig = {
      token: "test-token",
    };

    // Initialize the service (note: initialize calls doInitialize and sets the state)
    const initialState = await modelService.initialize(
      mockAssistant as any,
      mockAuthConfig as any,
    );

    // Verify we have models and the first one is selected
    const availableModels = modelService.getAvailableChatModels();
    expect(availableModels.length).toBe(2);
    expect(initialState.model).toBeDefined();
    expect((initialState.model as any).name).toBe("GPT-4");

    // Now switch should work
    await modelService.switchModel(1);
    expect(modelService.getCurrentModelIndex()).toBe(1);

    const modelInfo = modelService.getModelInfo();
    expect(modelInfo?.name).toBe("GPT-3.5");
  });

  it("should handle switching to invalid model index", async () => {
    // Initialize properly first
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-key",
        },
      ],
    };

    const mockAuthConfig = {
      token: "test-token",
    };

    await modelService.initialize(mockAssistant as any, mockAuthConfig as any);

    // Try to switch to invalid index
    try {
      await modelService.switchModel(5); // Only have 1 model at index 0
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain("Invalid model index");
    }
  });

  it("should successfully switch model when service is properly initialized via container", async () => {
    // This test simulates the fix where we ensure service is initialized before switching
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-key-1",
          roles: ["chat"],
        },
        {
          name: "GPT-3.5",
          provider: "openai",
          model: "gpt-3.5-turbo",
          apiKey: "test-key-2",
          roles: ["chat"],
        },
      ],
    };

    const mockAuthConfig = {
      token: "test-token",
    };

    // Initialize the service properly through initialize method (which sets isInitialized)
    await modelService.initialize(mockAssistant as any, mockAuthConfig as any);

    // Verify initialization
    expect(modelService.isReady()).toBe(true);
    expect(modelService.getCurrentModelIndex()).toBe(0);

    // Now switch should work and return success
    const newState = await modelService.switchModel(1);

    // Verify switch was successful
    expect(modelService.getCurrentModelIndex()).toBe(1);
    expect(newState.model).toBeDefined();
    expect((newState.model as any).name).toBe("GPT-3.5");

    // Get model info to verify success message data
    const modelInfo = modelService.getModelInfo();
    expect(modelInfo).toEqual({
      provider: "openai",
      name: "GPT-3.5",
    });

    // This is what the success message would use
    const successMessage = `Switched to model: ${modelInfo?.provider}/${modelInfo?.name}`;
    expect(successMessage).toBe("Switched to model: openai/GPT-3.5");
  });
});
