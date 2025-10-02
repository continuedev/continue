import { vi } from "vitest";

import { configEnhancer } from "../configEnhancer.js";
import { ModelService } from "./ModelService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { ToolPermissionService } from "./ToolPermissionService.js";
import { SERVICE_NAMES } from "./types.js";
import { WorkflowService } from "./WorkflowService.js";

// Mock the hubLoader module
vi.mock("../hubLoader.js", () => ({
  loadPackageFromHub: vi.fn(),
  mcpProcessor: {},
  modelProcessor: {},
  processRule: vi.fn(),
}));

// Mock the logger
vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock config module
vi.mock("../config.js", () => ({
  createLlmApi: vi.fn(),
  getLlmApi: vi.fn(),
}));

// Mock auth module
vi.mock("../auth/workos.js", () => ({
  getModelName: vi.fn(),
}));

describe("Workflow Integration Tests", () => {
  let workflowService: WorkflowService;
  let modelService: ModelService;
  let toolPermissionService: ToolPermissionService;
  let mockLoadPackageFromHub: any;
  let mockProcessRule: any;
  let mockCreateLlmApi: any;
  let mockGetLlmApi: any;

  const mockWorkflowFile = {
    name: "Test Workflow",
    description: "A test workflow for integration testing",
    model: "gpt-4-workflow",
    tools: "bash,read,write",
    rules: "Always be helpful and concise",
    prompt: "You are a workflow assistant.",
  };

  const mockAssistant = {
    models: [
      {
        provider: "openai",
        name: "gpt-3.5-turbo",
        roles: ["chat"],
      },
      {
        provider: "openai",
        name: "gpt-4",
        roles: ["chat"],
      },
    ],
  };

  const mockAuthConfig = {
    apiKey: "test-key",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mock functions
    const hubLoaderModule = await import("../hubLoader.js");
    const configModule = await import("../config.js");

    mockLoadPackageFromHub = hubLoaderModule.loadPackageFromHub as any;
    mockProcessRule = hubLoaderModule.processRule as any;
    mockCreateLlmApi = configModule.createLlmApi as any;
    mockGetLlmApi = configModule.getLlmApi as any;

    // Create service instances
    workflowService = new WorkflowService();
    modelService = new ModelService();
    toolPermissionService = new ToolPermissionService();

    // Mock service container
    vi.spyOn(serviceContainer, "get").mockImplementation(
      async (serviceName: string) => {
        if (serviceName === SERVICE_NAMES.WORKFLOW) {
          return workflowService.getState();
        }
        throw new Error(`Service ${serviceName} not mocked`);
      },
    );

    // Setup default mocks
    mockProcessRule.mockResolvedValue("Processed rule content");
    mockCreateLlmApi.mockReturnValue({ mock: "llmApi" });
    mockGetLlmApi.mockReturnValue([
      { mock: "llmApi" },
      mockAssistant.models[0],
    ]);
  });

  describe("WorkflowService affects ModelService", () => {
    it("should use workflow model when workflow is active", async () => {
      // Setup workflow service with active workflow
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      const workflowState = workflowService.getState();
      expect(workflowState.isActive).toBe(true);
      expect(workflowState.workflowFile?.model).toBe("gpt-4-workflow");

      // Initialize model service - it should use the workflow model
      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );

      expect(mockCreateLlmApi).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "gpt-4-workflow",
          provider: "openai",
        }),
        mockAuthConfig,
      );
    });

    it("should use regular models when no workflow is active", async () => {
      // Initialize workflow service without workflow
      await workflowService.initialize();

      const workflowState = workflowService.getState();
      expect(workflowState.isActive).toBe(false);

      // Initialize model service - it should use regular model selection
      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );

      expect(mockGetLlmApi).toHaveBeenCalledWith(mockAssistant, mockAuthConfig);
    });

    it("should handle workflow model that exists in assistant models", async () => {
      const workflowWithExistingModel = {
        ...mockWorkflowFile,
        model: "gpt-4", // This exists in mockAssistant.models
      };

      mockLoadPackageFromHub.mockResolvedValue(workflowWithExistingModel);
      await workflowService.initialize("owner/workflow");

      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );

      expect(mockCreateLlmApi).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "gpt-4",
          provider: "openai",
        }),
        mockAuthConfig,
      );
    });
  });

  describe("WorkflowService affects ConfigEnhancer", () => {
    it("should inject workflow rules when workflow is active", async () => {
      // Setup workflow service with active workflow
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      expect(mockProcessRule).toHaveBeenCalledWith(mockWorkflowFile.rules);
      expect(enhancedConfig.rules).toHaveLength(2);
      expect(enhancedConfig?.rules?.[0]).toEqual({
        name: "workflow:owner/workflow",
        rule: "Processed rule content",
      });
      expect(enhancedConfig?.rules?.[1]).toBe("existing rule");
    });

    it("should not inject workflow rules when workflow is inactive", async () => {
      // Initialize workflow service without workflow
      await workflowService.initialize();

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      expect(mockProcessRule).not.toHaveBeenCalled();
      expect(enhancedConfig.rules).toHaveLength(1);
      expect(enhancedConfig?.rules?.[0]).toBe("existing rule");
    });

    it("should not inject workflow rules when workflow has no rules", async () => {
      const workflowWithoutRules = {
        ...mockWorkflowFile,
        rules: undefined,
      };

      mockLoadPackageFromHub.mockResolvedValue(workflowWithoutRules);
      await workflowService.initialize("owner/workflow");

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      expect(mockProcessRule).not.toHaveBeenCalled();
      expect(enhancedConfig.rules).toHaveLength(1);
      expect(enhancedConfig.rules?.[0]).toBe("existing rule");
    });
  });

  describe("Workflow model constraints", () => {
    it("should filter available models to only workflow model when specified", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );

      // Verify that available models are filtered
      const availableModels = modelService.getAvailableChatModels();
      expect(availableModels).toHaveLength(1);
      expect(availableModels[0].name).toBe("gpt-4-workflow");
    });

    it("should allow all models when no workflow is active", async () => {
      await workflowService.initialize();

      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );

      const availableModels = modelService.getAvailableChatModels();
      expect(availableModels).toHaveLength(2);
      expect(availableModels.map((m) => m.name)).toEqual([
        "gpt-3.5-turbo",
        "gpt-4",
      ]);
    });
  });

  describe("Error handling", () => {
    it("should handle workflow loading errors gracefully", async () => {
      mockLoadPackageFromHub.mockRejectedValue(new Error("Network error"));

      await workflowService.initialize("owner/workflow");

      const workflowState = workflowService.getState();
      expect(workflowState.isActive).toBe(false);

      // Model service should work normally
      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );
      expect(mockGetLlmApi).toHaveBeenCalled();
    });

    it("should handle workflow rule processing errors gracefully", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      mockProcessRule.mockRejectedValue(new Error("Rule processing failed"));

      await workflowService.initialize("owner/workflow");

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      // Should not inject workflow rule but should preserve existing rules
      expect(enhancedConfig.rules).toHaveLength(1);
      expect(enhancedConfig.rules?.[0]).toBe("existing rule");
    });

    it("should handle missing service container gracefully", async () => {
      // Mock service container to throw error
      vi.spyOn(serviceContainer, "get").mockRejectedValue(
        new Error("Service not ready"),
      );

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      // Should return config unchanged
      expect(enhancedConfig.rules).toHaveLength(1);
      expect(enhancedConfig.rules?.[0]).toBe("existing rule");
    });
  });

  describe("Workflow data extraction", () => {
    it("should correctly extract all workflow properties", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      const workflowState = workflowService.getState();
      expect(workflowState.workflowFile?.model).toBe("gpt-4-workflow");
      expect(workflowState.workflowFile?.tools).toBe("bash,read,write");
      expect(workflowState.workflowFile?.rules).toBe(
        "Always be helpful and concise",
      );
      expect(workflowState.workflowFile?.prompt).toBe(
        "You are a workflow assistant.",
      );
      expect(workflowState.workflow).toBe("owner/workflow");
    });

    it("should handle partial workflow data", async () => {
      const partialWorkflow = {
        name: "Partial Workflow",
        model: "gpt-3.5-turbo",
        prompt: "Partial prompt",
        // No tools or rules
      };

      mockLoadPackageFromHub.mockResolvedValue(partialWorkflow);
      await workflowService.initialize("owner/partial");

      const workflowState = workflowService.getState();
      expect(workflowState.workflowFile?.model).toBe("gpt-3.5-turbo");
      expect(workflowState.workflowFile?.tools).toBeUndefined();
      expect(workflowState.workflowFile?.rules).toBeUndefined();
      expect(workflowState.workflowFile?.prompt).toBe("Partial prompt");
    });
  });
});
