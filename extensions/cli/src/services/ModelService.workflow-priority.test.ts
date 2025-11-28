import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthConfig } from "../auth/workos.js";
import * as config from "../config.js";

import { ModelService } from "./ModelService.js";
import { AgentFileServiceState } from "./types.js";

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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ModelService agent file model prioritization", () => {
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

  it("should prioritize agent file model over default when agent file has model specified", async () => {
    const agentFileServiceState: AgentFileServiceState = {
      agentFile: {
        name: "test-agent",
        model: "gpt-4",
        prompt: "Test agent",
      },
      slug: "test/agent",
      agentFileModel: {
        name: "gpt-4",
        model: "gpt-4",
        provider: "openai",
      },
      parsedRules: null,
      parsedTools: null,
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
      agentFileServiceState,
    );

    expect(result.model).toEqual(
      expect.objectContaining({
        name: "gpt-4",
        provider: "openai",
      }),
    );

    // Should have called createLlmApi with the agent-file-specified model
    expect(createLlmApiMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "gpt-4" }),
      mockAuthConfig,
    );
  });

  it("should fall back to persisted model when no agent file model is specified", async () => {
    const agentFileServiceState: AgentFileServiceState = {
      agentFile: {
        name: "test-agent",
        prompt: "Test agent file",
        // No model specified
      },
      slug: "test/agent",
      agentFileModel: null,
      parsedRules: null,
      parsedTools: null,
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
      agentFileServiceState,
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

  it("should fall back to default model when agent file model is not available", async () => {
    const agentFileServiceState: AgentFileServiceState = {
      agentFile: {
        name: "test-agent",
        model: "non-existent-model", // Model not in available models
        prompt: "Test agent",
      },
      slug: "test/agent",
      agentFileModel: {
        name: "non-existent-model",
        model: "non-existent",
        provider: "nonexistent",
      },
      parsedRules: null,
      parsedTools: null,
    };

    const getLlmApiMock = vi.mocked(config.getLlmApi);
    getLlmApiMock.mockReturnValue([
      { provider: "default" } as any,
      { provider: "anthropic", name: "claude-3-sonnet" } as ModelConfig,
    ]);

    const result = await modelService.doInitialize(
      mockAssistant,
      mockAuthConfig,
      agentFileServiceState,
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

  it("should use default model when no agent file exists", async () => {
    const agentFileServiceState: AgentFileServiceState = {
      agentFile: null,
      slug: null,
      agentFileModel: null,
      parsedRules: null,
      parsedTools: null,
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
      agentFileServiceState,
    );

    expect(result.model).toEqual(
      expect.objectContaining({
        name: "claude-3-sonnet",
        provider: "anthropic",
      }),
    );

    expect(getLlmApiMock).toHaveBeenCalledWith(mockAssistant, mockAuthConfig);
  });

  it("should prioritize agent file model over persisted model", async () => {
    const agentFileServiceState: AgentFileServiceState = {
      agentFile: {
        name: "test-agent",
        model: "gpt-4", // Agent file specifies gpt-4
        prompt: "Test agent",
      },
      slug: "test/agent",
      agentFileModel: {
        name: "gpt-4",
        model: "gpt-4",
        provider: "openai",
      },
      parsedRules: null,
      parsedTools: null,
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
      agentFileServiceState,
    );

    // Should use agent file model (gpt-4), not persisted model (claude-3-haiku)
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
