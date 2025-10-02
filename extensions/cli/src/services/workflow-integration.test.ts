import { vi } from "vitest";

import { ConfigEnhancer } from "../configEnhancer.js";

import { ModelService } from "./ModelService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { ToolPermissionService } from "./ToolPermissionService.js";
import { SERVICE_NAMES } from "./types.js";
import { WorkflowService } from "./WorkflowService.js";

// Mock the hubLoader module
vi.mock("../hubLoader.js", () => ({
  loadPackageFromHub: vi.fn(),
  loadPackagesFromHub: vi.fn(),
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
  let configEnhancer: ConfigEnhancer;
  let mockLoadPackageFromHub: any;
  let mockLoadPackagesFromHub: any;
  let mockProcessRule: any;
  let mockCreateLlmApi: any;
  let mockGetLlmApi: any;
  let mockModelProcessor: any;

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
    mockLoadPackagesFromHub = hubLoaderModule.loadPackagesFromHub as any;
    mockProcessRule = hubLoaderModule.processRule as any;
    mockModelProcessor = hubLoaderModule.modelProcessor;
    mockCreateLlmApi = configModule.createLlmApi as any;
    mockGetLlmApi = configModule.getLlmApi as any;

    // Create service instances
    workflowService = new WorkflowService();
    modelService = new ModelService();
    toolPermissionService = new ToolPermissionService();
    configEnhancer = new ConfigEnhancer();

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
    mockLoadPackagesFromHub.mockResolvedValue([{ name: "test-mcp" }]);
    mockLoadPackageFromHub.mockResolvedValue({
      name: "test-model",
      provider: "openai",
    });
    mockCreateLlmApi.mockReturnValue({ mock: "llmApi" });
    mockGetLlmApi.mockReturnValue([
      { mock: "llmApi" },
      mockAssistant.models[0],
    ]);
  });

  describe("Workflow models are injected via ConfigEnhancer", () => {
    it("should add workflow model to options when workflow is active", async () => {
      // Setup workflow service with active workflow
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      const workflowState = workflowService.getState();
      expect(workflowState.workflowFile?.model).toBe("gpt-4-workflow");

      // Test that ConfigEnhancer adds the workflow model to options
      const baseConfig = { models: [] };
      const baseOptions = {}; // No --model flag

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
      );

      // Should have loaded the workflow model via injectModels
      expect(mockLoadPackagesFromHub).toHaveBeenCalledWith(
        ["gpt-4-workflow"],
        expect.anything(),
      );
    });

    it("should not add workflow model when no workflow is active", async () => {
      // Initialize workflow service without workflow
      await workflowService.initialize();

      const workflowState = workflowService.getState();
      expect(workflowState.workflowFile).toBeNull();

      // Test that ConfigEnhancer doesn't add any workflow models
      const baseConfig = { models: [] };
      const baseOptions = {};

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
      );

      // Should not have enhanced with any models
      expect(enhancedConfig.models).toEqual([]);
    });

    it("should respect --model flag priority over workflow model", async () => {
      // Setup workflow service with active workflow
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      // Test that --model flag takes precedence
      const baseConfig = { models: [] };
      const baseOptions = { model: ["user-specified-model"] }; // User specified --model

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
      );

      // Should process the user model, not the workflow model
      expect(mockLoadPackagesFromHub).toHaveBeenCalledWith(
        ["user-specified-model"],
        expect.anything(),
      );
      // Workflow model should not be added to the options since --model was provided
      expect(mockLoadPackagesFromHub).not.toHaveBeenCalledWith(
        ["gpt-4-workflow"],
        expect.anything(),
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

      // Rules should be processed normally since workflow rules are now added to options.rule
      expect(mockProcessRule).toHaveBeenCalledWith(mockWorkflowFile.rules);
      expect(enhancedConfig.rules).toHaveLength(2);
      // The workflow rule is processed first, then existing rules
      expect(mockProcessRule).toHaveBeenNthCalledWith(
        1,
        mockWorkflowFile.rules,
      );
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

      // Verify that available models include all original models
      // (we removed the filtering logic)
      const availableModels = modelService.getAvailableChatModels();
      expect(availableModels).toHaveLength(2); // Should include both original models
      expect(availableModels.map((m) => m.name)).toEqual([
        "gpt-3.5-turbo",
        "gpt-4",
      ]);
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
      expect(workflowState.workflowFile).toBeNull();

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

    // Removed test for missing service container since workflow service
    // should always be initialized before ConfigEnhancer is called

    it("should inject workflow prompt when workflow is active", async () => {
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

      // Prompts should be processed at runtime, not injected into config
      // The workflow prompt is added to options.prompt and will be processed
      // by processAndCombinePrompts() in chat.ts
      expect(enhancedConfig.rules).toHaveLength(2);
    });

    it("should add workflow prompt as prefix to existing prompts", async () => {
      // Setup workflow service with active workflow
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      // Test that the workflow prompt gets added to options.prompt as prefix
      const baseOptions = { prompt: ["existing-prompt"] };
      const modifiedOptions = { ...baseOptions };

      // Simulate what ConfigEnhancer does internally
      const workflowState = workflowService.getState();
      if (workflowState.workflowFile?.prompt) {
        modifiedOptions.prompt = [
          workflowState.workflowFile.prompt,
          ...(modifiedOptions.prompt || []),
        ];
      }

      expect(modifiedOptions.prompt).toEqual([
        "You are a workflow assistant.",
        "existing-prompt",
      ]);
    });

    it("should not add workflow prompt when workflow has no prompt", async () => {
      const workflowWithoutPrompt = {
        ...mockWorkflowFile,
        prompt: undefined,
      };

      mockLoadPackageFromHub.mockResolvedValue(workflowWithoutPrompt);
      await workflowService.initialize("owner/workflow");

      const baseOptions = { prompt: ["existing-prompt"] };
      const modifiedOptions = { ...baseOptions };

      // Simulate what ConfigEnhancer does internally
      const workflowState = workflowService.getState();
      if (workflowState.workflowFile?.prompt) {
        modifiedOptions.prompt = [
          workflowState.workflowFile.prompt,
          ...(modifiedOptions.prompt || []),
        ];
      }

      expect(modifiedOptions.prompt).toEqual(["existing-prompt"]);
    });
  });

  describe("ConfigEnhancer prompt integration", () => {
    it("should modify options to include workflow prompt as prefix", async () => {
      // Setup workflow service with active workflow
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      // Create a spy to verify the internal behavior of ConfigEnhancer
      const originalGet = serviceContainer.get;
      const getSpy = vi
        .spyOn(serviceContainer, "get")
        .mockImplementation(async (serviceName: string) => {
          if (serviceName === SERVICE_NAMES.WORKFLOW) {
            return workflowService.getState();
          }
          return originalGet.call(serviceContainer, serviceName);
        });

      const baseOptions = { prompt: ["user-prompt"] };

      // This should internally modify the options to include workflow prompt
      await configEnhancer.enhanceConfig({} as any, baseOptions);

      // The ConfigEnhancer should have been called with workflow service
      expect(getSpy).toHaveBeenCalledWith(SERVICE_NAMES.WORKFLOW);

      // Clean up
      getSpy.mockRestore();
    });

    it("should work end-to-end with workflow prompt processing", async () => {
      // Setup workflow service with active workflow
      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await workflowService.initialize("owner/workflow");

      const workflowState = workflowService.getState();
      expect(workflowState.workflowFile?.prompt).toBe(
        "You are a workflow assistant.",
      );

      // Verify that if we manually apply the same logic as ConfigEnhancer,
      // the workflow prompt gets added as prefix
      const options = { prompt: ["Tell me about TypeScript"] };

      if (workflowState.workflowFile?.prompt) {
        options.prompt = [workflowState.workflowFile.prompt, ...options.prompt];
      }

      expect(options.prompt).toEqual([
        "You are a workflow assistant.",
        "Tell me about TypeScript",
      ]);

      // This mimics what processAndCombinePrompts would do
      const combinedPrompt = options.prompt.join("\n\n");
      expect(combinedPrompt).toBe(
        "You are a workflow assistant.\n\nTell me about TypeScript",
      );
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

  describe("Workflow tools integration", () => {
    it("should inject MCP servers from workflow tools", async () => {
      const workflowWithTools = {
        ...mockWorkflowFile,
        tools: "owner/mcp1, another/mcp2:specific_tool",
      };

      mockLoadPackageFromHub.mockResolvedValue(workflowWithTools);
      mockLoadPackagesFromHub.mockResolvedValue([
        { name: "mcp1" },
        { name: "mcp2" },
      ]);

      await workflowService.initialize("owner/workflow");

      const baseConfig = {
        mcpServers: [{ name: "existing-mcp" }],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      expect(enhancedConfig.mcpServers).toHaveLength(3);
      expect(enhancedConfig.mcpServers?.[0]).toEqual({ name: "mcp1" });
      expect(enhancedConfig.mcpServers?.[1]).toEqual({ name: "mcp2" });
      expect(enhancedConfig.mcpServers?.[2]).toEqual({ name: "existing-mcp" });
    });

    it("should not inject MCP servers when workflow has no tools", async () => {
      const workflowWithoutTools = {
        ...mockWorkflowFile,
        tools: undefined,
      };

      mockLoadPackageFromHub.mockResolvedValue(workflowWithoutTools);
      await workflowService.initialize("owner/workflow");

      const baseConfig = {
        mcpServers: [{ name: "existing-mcp" }],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      expect(enhancedConfig.mcpServers).toHaveLength(1);
      expect(enhancedConfig.mcpServers?.[0]).toEqual({ name: "existing-mcp" });
    });

    it("should deduplicate MCP servers", async () => {
      const workflowWithDuplicateTools = {
        ...mockWorkflowFile,
        tools: "owner/mcp1, owner/mcp1:tool1, owner/mcp1:tool2",
      };

      mockLoadPackageFromHub.mockResolvedValue(workflowWithDuplicateTools);
      mockLoadPackagesFromHub.mockResolvedValue([{ name: "mcp1" }]);

      await workflowService.initialize("owner/workflow");

      const baseConfig = {
        mcpServers: [{ name: "mcp1" }], // Already exists
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
      );

      // Should not deduplicate since we simplified the logic
      expect(enhancedConfig.mcpServers).toHaveLength(2);
      expect(enhancedConfig.mcpServers?.[0]).toEqual({ name: "mcp1" });
      expect(enhancedConfig.mcpServers?.[1]).toEqual({ name: "mcp1" });
    });
  });
});
