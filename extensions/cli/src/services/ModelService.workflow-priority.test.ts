import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthConfig } from "../auth/workos.js";
import * as config from "../config.js";

import { ModelService } from "./ModelService.js";
import { WorkflowServiceState } from "./types.js";

// Mock the dependencies
vi.mock("../auth/workos.js", () => ({
  getModelName: vi.fn(() => null),
}));

vi.mock("../config.js", () => ({
  createLlmApi: vi.fn(() => ({ provider: "test" })),
  getLlmApi: vi.fn(() => [
    { provider: "test" },
    { provider: "test", name: "default-model" },
  ]),
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ModelService workflow model prioritization", () => {
  let modelService: ModelService;
  let mockAssistant: AssistantUnrolled;
  let mockAuthConfig: AuthConfig;
  let mockModels: ModelConfig[];

  beforeEach(() => {
    modelService = new ModelService();

    mockModels = [
      { provider: "anthropic", name: "claude-3-sonnet" } as ModelConfig,
      { provider: "openai", name: "gpt-4" } as ModelConfig,
      { provider: "anthropic", name: "claude-3-haiku" } as ModelConfig,
    ];

    mockAssistant = {
      models: mockModels,
    } as AssistantUnrolled;

    mockAuthConfig = {} as AuthConfig;

    // Reset mocks
    vi.clearAllMocks();
  });

  it("should prioritize workflow model over default when workflow file has model specified", async () => {
    const workflowServiceState: WorkflowServiceState = {
      workflowFile: {
        name: "test-workflow",
        model: "gpt-4",
        prompt: "Test workflow",
      },
      workflow: "test/workflow",
    };

    // Mock createLlmApi to return different models based on the selected model
    const createLlmApiMock = vi.mocked(config.createLlmApi);
    createLlmApiMock.mockImplementation(
      (model: ModelConfig) =>
        ({
          provider: model.provider,
          name: (model as any).name,
        }) as any,
    );

    const result = await modelService.doInitialize(
      mockAssistant,
      mockAuthConfig,
      workflowServiceState,
    );

    expect(result.model).toEqual(
      expect.objectContaining({
        name: "gpt-4",
        provider: "openai",
      }),
    );

    // Should have called createLlmApi with the workflow-specified model
    expect(createLlmApiMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "gpt-4" }),
      mockAuthConfig,
    );
  });

  it("should fall back to persisted model when no workflow model is specified", async () => {
    const workflowServiceState: WorkflowServiceState = {
      workflowFile: {
        name: "test-workflow",
        prompt: "Test workflow",
        // No model specified
      },
      workflow: "test/workflow",
    };

    // Mock getModelName to return a persisted model
    const { getModelName } = await import("../auth/workos.js");
    vi.mocked(getModelName).mockReturnValue("claude-3-sonnet");

    const createLlmApiMock = vi.mocked(config.createLlmApi);
    createLlmApiMock.mockImplementation(
      (model: ModelConfig) =>
        ({
          provider: model.provider,
          name: (model as any).name,
        }) as any,
    );

    const result = await modelService.doInitialize(
      mockAssistant,
      mockAuthConfig,
      workflowServiceState,
    );

    expect(result.model).toEqual(
      expect.objectContaining({
        name: "claude-3-sonnet",
        provider: "anthropic",
      }),
    );

    expect(createLlmApiMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "claude-3-sonnet" }),
      mockAuthConfig,
    );
  });

  it("should fall back to default model when workflow model is not available", async () => {
    const workflowServiceState: WorkflowServiceState = {
      workflowFile: {
        name: "test-workflow",
        model: "non-existent-model", // Model not in available models
        prompt: "Test workflow",
      },
      workflow: "test/workflow",
    };

    const getLlmApiMock = vi.mocked(config.getLlmApi);
    getLlmApiMock.mockReturnValue([
      { provider: "default" } as any,
      { provider: "anthropic", name: "claude-3-sonnet" } as ModelConfig,
    ]);

    const result = await modelService.doInitialize(
      mockAssistant,
      mockAuthConfig,
      workflowServiceState,
    );

    expect(result.model).toEqual(
      expect.objectContaining({
        name: "claude-3-sonnet",
        provider: "anthropic",
      }),
    );

    // Should have fallen back to getLlmApi
    expect(getLlmApiMock).toHaveBeenCalledWith(mockAssistant, mockAuthConfig);
  });

  it("should use default model when no workflow file exists", async () => {
    const workflowServiceState: WorkflowServiceState = {
      workflowFile: null,
      workflow: null,
    };

    // Make sure getModelName returns null (no persisted model)
    const { getModelName } = await import("../auth/workos.js");
    vi.mocked(getModelName).mockReturnValue(null);

    const getLlmApiMock = vi.mocked(config.getLlmApi);
    getLlmApiMock.mockReturnValue([
      { provider: "default" } as any,
      { provider: "anthropic", name: "claude-3-sonnet" } as ModelConfig,
    ]);

    const result = await modelService.doInitialize(
      mockAssistant,
      mockAuthConfig,
      workflowServiceState,
    );

    expect(result.model).toEqual(
      expect.objectContaining({
        name: "claude-3-sonnet",
        provider: "anthropic",
      }),
    );

    expect(getLlmApiMock).toHaveBeenCalledWith(mockAssistant, mockAuthConfig);
  });

  it("should prioritize workflow model over persisted model", async () => {
    const workflowServiceState: WorkflowServiceState = {
      workflowFile: {
        name: "test-workflow",
        model: "gpt-4", // Workflow specifies gpt-4
        prompt: "Test workflow",
      },
      workflow: "test/workflow",
    };

    // Mock getModelName to return a different persisted model
    const { getModelName } = await import("../auth/workos.js");
    vi.mocked(getModelName).mockReturnValue("claude-3-haiku");

    const createLlmApiMock = vi.mocked(config.createLlmApi);
    createLlmApiMock.mockImplementation(
      (model: ModelConfig) =>
        ({
          provider: model.provider,
          name: (model as any).name,
        }) as any,
    );

    const result = await modelService.doInitialize(
      mockAssistant,
      mockAuthConfig,
      workflowServiceState,
    );

    // Should use workflow model (gpt-4), not persisted model (claude-3-haiku)
    expect(result.model).toEqual(
      expect.objectContaining({
        name: "gpt-4",
        provider: "openai",
      }),
    );

    expect(createLlmApiMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "gpt-4" }),
      mockAuthConfig,
    );
  });
});
