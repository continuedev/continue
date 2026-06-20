import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock dependencies before imports
vi.mock("../config.js");
vi.mock("../auth/workos.js");

import * as workos from "../auth/workos.js";
import { AuthConfig } from "../auth/workos.js";
import * as config from "../config.js";

import { ModelService, expandAutodetectModels } from "./ModelService.js";

describe("ModelService", () => {
  let service: ModelService;
  let mockAssistant: AssistantUnrolled;
  let mockAuthConfig: AuthConfig;
  const mockLlmApi = { complete: vi.fn(), stream: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ModelService();

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
          model: "claude-3",
          name: "Claude 3",
          apiKey: "test-key",
          roles: ["chat"],
        } as ModelConfig,
        {
          provider: "openai",
          model: "gpt-3.5",
          name: "GPT-3.5",
          apiKey: "test-key",
          roles: ["embed"],
        } as ModelConfig,
      ],
    } as AssistantUnrolled;

    mockAuthConfig = null;
  });

  describe("State Management", () => {
    test("should initialize with default model", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      vi.mocked(workos.getModelName).mockReturnValue(null);

      const state = await service.initialize(mockAssistant, mockAuthConfig);

      expect(state).toEqual({
        llmApi: mockLlmApi,
        model: mockAssistant.models![0],
        assistant: mockAssistant,
        authConfig: mockAuthConfig,
      });
    });

    test("should initialize with persisted model if valid", async () => {
      vi.mocked(workos.getModelName).mockReturnValue("Claude 3");
      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      const state = await service.initialize(mockAssistant, mockAuthConfig);

      expect(state.model?.name).toBe("Claude 3");
      expect(state.llmApi).toStrictEqual(mockLlmApi);
    });

    test("should fall back to default if persisted model not found", async () => {
      vi.mocked(workos.getModelName).mockReturnValue("Non-existent Model");
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);

      const state = await service.initialize(mockAssistant, mockAuthConfig);

      expect(state.model).toBe(mockAssistant.models![0]);
    });
  });

  describe("switchModel()", () => {
    test("should switch to a different model by index", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      const newLlmApi = { complete: vi.fn(), stream: vi.fn() };
      vi.mocked(config.createLlmApi).mockReturnValue(newLlmApi as any);

      const state = await service.switchModel(1);

      expect(state).toEqual({
        llmApi: newLlmApi,
        model: mockAssistant.models![1],
        assistant: mockAssistant,
        authConfig: mockAuthConfig,
      });
      expect(service.getState()).toEqual(state);
    });

    test("should throw error for invalid model index", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      await expect(service.switchModel(5)).rejects.toThrow(
        "Invalid model index: 5. Available models: 0-1",
      );
      await expect(service.switchModel(-1)).rejects.toThrow(
        "Invalid model index: -1. Available models: 0-1",
      );
    });

    test("should throw error when service not initialized", async () => {
      await expect(service.switchModel(0)).rejects.toThrow(
        "ModelService not initialized",
      );
    });

    test("should handle continue-proxy provider specially", async () => {
      const proxyModel = {
        provider: "continue-proxy",
        model: "proxy-model",
        name: "Proxy Model",
        apiBase: "https://proxy.continue.dev",
        apiKeyLocation: "env.PROXY_KEY",
        roles: ["chat"],
      } as ModelConfig;

      mockAssistant.models = [proxyModel];
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        proxyModel,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      await service.switchModel(0);

      expect(vi.mocked(config.createLlmApi)).toHaveBeenCalledWith(
        proxyModel,
        mockAuthConfig,
      );
    });
  });

  describe("getAvailableChatModels()", () => {
    test("should return only models with chat role", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      const models = service.getAvailableChatModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        provider: "openai",
        name: "GPT-4",
        index: 0,
      });
      expect(models[1]).toEqual({
        provider: "anthropic",
        name: "Claude 3",
        index: 1,
      });
    });

    test("should include models with undefined roles", async () => {
      // Add a model with undefined roles to the assistant
      const assistantWithUndefinedRoles = {
        ...mockAssistant,
        models: [
          ...mockAssistant.models!,
          {
            provider: "local",
            model: "llama-2",
            name: "Llama 2",
            apiKey: "test-key",
            // roles is undefined
          } as ModelConfig,
        ],
      };

      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        assistantWithUndefinedRoles.models![0] as ModelConfig,
      ]);
      await service.initialize(assistantWithUndefinedRoles, mockAuthConfig);

      const models = service.getAvailableChatModels();

      // Should include the two chat models and the model with undefined roles
      expect(models).toHaveLength(3);
      expect(models[2]).toEqual({
        provider: "local",
        name: "Llama 2",
        index: 2,
      });
    });
  });

  describe("getCurrentModelIndex()", () => {
    test("should return correct index of current model", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      expect(service.getCurrentModelIndex()).toBe(0);

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);
      await service.switchModel(1);
      expect(service.getCurrentModelIndex()).toBe(1);
    });

    test("should return -1 when no model is set", () => {
      expect(service.getCurrentModelIndex()).toBe(-1);
    });
  });

  describe("getModelIndexByName()", () => {
    test("should find model by name", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      expect(service.getModelIndexByName("GPT-4")).toBe(0);
      expect(service.getModelIndexByName("Claude 3")).toBe(1);
      expect(service.getModelIndexByName("Non-existent")).toBe(-1);
    });

    test("should find model by name and provider", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      expect(service.getModelIndexByName("GPT-4", "openai")).toBe(0);
      expect(service.getModelIndexByName("GPT-4", "anthropic")).toBe(-1);
    });
  });

  describe("getModelInfo()", () => {
    test("should return current model info", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      expect(service.getModelInfo()).toEqual({
        provider: "openai",
        name: "GPT-4",
      });
    });

    test("should return null when no model set", () => {
      expect(service.getModelInfo()).toBeNull();
    });
  });

  describe("isReady()", () => {
    test("should return false when not initialized", () => {
      expect(service.isReady()).toBe(false);
    });

    test("should return true when initialized with model and llmApi", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      expect(service.isReady()).toBe(true);
    });

    test("should return false if llmApi is null", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        null as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      expect(service.isReady()).toBe(false);
    });
  });

  describe("getDependencies()", () => {
    test("should declare auth, config, and agent-file dependencies", () => {
      expect(service.getDependencies()).toEqual([
        "auth",
        "config",
        "agentFile",
      ]);
    });
  });

  describe("Event Emission", () => {
    test("should emit stateChanged on model switch", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      const listener = vi.fn();
      service.on("stateChanged", listener);

      const newLlmApi = { complete: vi.fn(), stream: vi.fn() };
      vi.mocked(config.createLlmApi).mockReturnValue(newLlmApi as any);
      await service.switchModel(1);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockAssistant.models![1],
          llmApi: newLlmApi,
        }),
        expect.objectContaining({
          model: mockAssistant.models![0],
          llmApi: mockLlmApi,
        }),
      );
    });

    test("should emit error on switch failure", async () => {
      vi.mocked(config.getLlmApi).mockReturnValue([
        mockLlmApi as any,
        mockAssistant.models![0] as ModelConfig,
      ]);
      await service.initialize(mockAssistant, mockAuthConfig);

      const errorListener = vi.fn();
      service.on("error", errorListener);

      vi.mocked(config.createLlmApi).mockReturnValue(null as any);

      await expect(service.switchModel(1)).rejects.toThrow(
        "Failed to initialize LLM",
      );
      expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("expandAutodetectModels()", () => {
    test("expands AUTODETECT into concrete models", async () => {
      const autodetectModel: ModelConfig = {
        provider: "ollama",
        model: "AUTODETECT",
        apiBase: "http://localhost:11434",
        roles: ["chat"],
      } as ModelConfig;

      const mockLlmApi = {
        list: vi.fn().mockResolvedValue([
          { id: "llama3", object: "model", owned_by: "ollama" },
          { id: "mistral", object: "model", owned_by: "ollama" },
        ]),
      };

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      const result = await expandAutodetectModels(
        [autodetectModel],
        mockAuthConfig,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...autodetectModel,
        model: "llama3",
        name: "llama3",
      });
      expect(result[1]).toEqual({
        ...autodetectModel,
        model: "mistral",
        name: "mistral",
      });
    });

    test("passes through non-AUTODETECT models unchanged", async () => {
      const gpt4Model: ModelConfig = {
        provider: "openai",
        model: "gpt-4",
        name: "GPT-4",
        apiKey: "test-key",
        roles: ["chat"],
      } as ModelConfig;

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      const result = await expandAutodetectModels([gpt4Model], mockAuthConfig);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(gpt4Model);
    });

    test("handles list() failure gracefully", async () => {
      const autodetectModel: ModelConfig = {
        provider: "ollama",
        model: "AUTODETECT",
        apiBase: "http://localhost:11434",
        roles: ["chat"],
      } as ModelConfig;

      const mockLlmApi = {
        list: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      const result = await expandAutodetectModels(
        [autodetectModel],
        mockAuthConfig,
      );

      // AUTODETECT entry should be skipped when list() fails
      expect(result).toHaveLength(0);
    });

    test("handles empty list() results", async () => {
      const autodetectModel: ModelConfig = {
        provider: "ollama",
        model: "AUTODETECT",
        apiBase: "http://localhost:11434",
        roles: ["chat"],
      } as ModelConfig;

      const mockLlmApi = {
        list: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      const result = await expandAutodetectModels(
        [autodetectModel],
        mockAuthConfig,
      );

      // AUTODETECT entry should be skipped when no models are returned
      expect(result).toHaveLength(0);
    });

    test("filters out AUTODETECT from list results", async () => {
      const autodetectModel: ModelConfig = {
        provider: "ollama",
        model: "AUTODETECT",
        apiBase: "http://localhost:11434",
        roles: ["chat"],
      } as ModelConfig;

      const mockLlmApi = {
        list: vi.fn().mockResolvedValue([
          { id: "AUTODETECT", object: "model", owned_by: "ollama" },
          { id: "real-model", object: "model", owned_by: "ollama" },
        ]),
      };

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      const result = await expandAutodetectModels(
        [autodetectModel],
        mockAuthConfig,
      );

      // Only real-model should appear, AUTODETECT should be filtered
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...autodetectModel,
        model: "real-model",
        name: "real-model",
      });
    });

    test("handles mixed AUTODETECT and non-AUTODETECT models", async () => {
      const autodetectModel: ModelConfig = {
        provider: "ollama",
        model: "AUTODETECT",
        apiBase: "http://localhost:11434",
        roles: ["chat"],
      } as ModelConfig;

      const gpt4Model: ModelConfig = {
        provider: "openai",
        model: "gpt-4",
        name: "GPT-4",
        apiKey: "test-key",
        roles: ["chat"],
      } as ModelConfig;

      const mockLlmApi = {
        list: vi
          .fn()
          .mockResolvedValue([
            { id: "llama3", object: "model", owned_by: "ollama" },
          ]),
      };

      vi.mocked(config.createLlmApi).mockReturnValue(mockLlmApi as any);

      const result = await expandAutodetectModels(
        [autodetectModel, gpt4Model],
        mockAuthConfig,
      );

      // Should have the expanded llama3 and the unchanged gpt-4
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...autodetectModel,
        model: "llama3",
        name: "llama3",
      });
      expect(result[1]).toBe(gpt4Model);
    });

    test("handles createLlmApi returning null", async () => {
      const autodetectModel: ModelConfig = {
        provider: "invalid-provider",
        model: "AUTODETECT",
        roles: ["chat"],
      } as ModelConfig;

      vi.mocked(config.createLlmApi).mockReturnValue(null as any);

      const result = await expandAutodetectModels(
        [autodetectModel],
        mockAuthConfig,
      );

      // AUTODETECT entry should be skipped when createLlmApi returns null
      expect(result).toHaveLength(0);
    });
  });
});
