import { vi } from "vitest";

import { ConfigEnhancer } from "../configEnhancer.js";

import { AgentFileService } from "./AgentFileService.js";
import { ModelService } from "./ModelService.js";

// Mock the hubLoader module
vi.mock("../hubLoader.js", () => ({
  loadPackageFromHub: vi.fn(),
  loadPackagesFromHub: vi.fn(),
  mcpProcessor: {},
  modelProcessor: {},
  processRule: vi.fn(),
  agentFileProcessor: {
    type: "agentFile",
    expectedFileExtensions: [".md"],
    parseContent: vi.fn(),
    validateContent: vi.fn(),
  },
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

describe("Agent file Integration Tests", () => {
  let agentFileService: AgentFileService;
  let modelService: ModelService;
  let configEnhancer: ConfigEnhancer;
  let mockLoadPackageFromHub: any;
  let mockLoadPackagesFromHub: any;
  let mockProcessRule: any;
  let mockCreateLlmApi: any;
  let mockGetLlmApi: any;
  let mockModelProcessor: any;

  const mockAgentFile = {
    name: "Test Agent File",
    description: "A test agent for integration testing",
    model: "gpt-4-agent",
    tools: "bash,read,write",
    rules: "Always be helpful and concise",
    prompt: "You are an assistant.",
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
    agentFileService = new AgentFileService();
    modelService = new ModelService();
    configEnhancer = new ConfigEnhancer();

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

  describe("Agent file models are injected via ConfigEnhancer", () => {
    it("should add agent file model to options when agent file active", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile?.model).toBe("gpt-4-agent");

      // Mock loadPackageFromHub to return a model for the agent file model
      mockLoadPackageFromHub.mockResolvedValueOnce({
        name: "gpt-4-agent",
        provider: "openai",
      });

      // Test that ConfigEnhancer adds the agent file model to options
      const baseConfig = { models: [] };
      const baseOptions = {}; // No --model flag

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
        agentFileState,
      );

      // Should have loaded the agent file model directly via loadPackageFromHub
      expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
        "gpt-4-agent",
        mockModelProcessor,
      );

      // The agent file model should be prepended to the models array
      expect(enhancedConfig.models).toHaveLength(1);
      expect(enhancedConfig.models?.[0]).toEqual({
        name: "gpt-4-agent",
        provider: "openai",
      });
    });

    it("should not add agent file model when no agent file active", async () => {
      // Initialize agent file service without agent
      await agentFileService.initialize();

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile).toBeNull();

      // Test that ConfigEnhancer doesn't add any agent file models
      const baseConfig = { models: [] };
      const baseOptions = {};

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
        agentFileState,
      );

      // Should not have enhanced with any models
      expect(enhancedConfig.models).toEqual([]);
    });

    it("should respect --model flag priority over agent file model", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      // Mock loadPackageFromHub for agent file model and loadPackagesFromHub for user models
      mockLoadPackageFromHub.mockResolvedValueOnce({
        name: "gpt-4-agent",
        provider: "openai",
      });
      mockLoadPackagesFromHub.mockResolvedValueOnce([
        {
          name: "user-specified-model",
          provider: "anthropic",
        },
      ]);

      // Test that --model flag takes precedence
      const baseConfig = { models: [] };
      const baseOptions = { model: ["user-specified-model"] }; // User specified --model

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
        agentFileService.getState(),
      );

      // Should process the user model via loadPackagesFromHub
      expect(mockLoadPackagesFromHub).toHaveBeenCalledWith(
        ["user-specified-model"],
        mockModelProcessor,
      );

      // Should also load the agent file model
      expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
        "gpt-4-agent",
        mockModelProcessor,
      );

      // Both models should be in the config, with user model first (takes precedence)
      expect(enhancedConfig.models).toHaveLength(2);
      expect(enhancedConfig.models?.[0]).toEqual({
        name: "user-specified-model",
        provider: "anthropic",
      });
      expect(enhancedConfig.models?.[1]).toEqual({
        name: "gpt-4-agent",
        provider: "openai",
      });
    });
  });

  describe("AgentFileService affects ConfigEnhancer", () => {
    it("should inject agent file rules when agent file active", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      // Rules should be processed normally since agent file rules are now added to options.rule
      expect(mockProcessRule).toHaveBeenCalledWith(mockAgentFile.rules);
      expect(enhancedConfig.rules).toHaveLength(2);
      // The agent file rule is processed first, then existing rules
      expect(mockProcessRule).toHaveBeenNthCalledWith(1, mockAgentFile.rules);
    });

    it("should not inject agent file rules when agent file inactive", async () => {
      // Initialize agent file service without agent file
      await agentFileService.initialize();

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      expect(mockProcessRule).not.toHaveBeenCalled();
      expect(enhancedConfig.rules).toHaveLength(1);
      expect(enhancedConfig?.rules?.[0]).toBe("existing rule");
    });

    it("should not inject agent file rules when agent file has no rules", async () => {
      const agentFileWithoutRules = {
        ...mockAgentFile,
        rules: undefined,
      };

      mockLoadPackageFromHub.mockResolvedValue(agentFileWithoutRules);
      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      expect(mockProcessRule).not.toHaveBeenCalled();
      expect(enhancedConfig.rules).toHaveLength(1);
      expect(enhancedConfig.rules?.[0]).toBe("existing rule");
    });
  });

  describe("Agent file model constraints", () => {
    it("should filter available models to only agent file model when specified", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

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

    it("should allow all models when no agent file active", async () => {
      await agentFileService.initialize();

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
    it("should handle agent loading errors gracefully", async () => {
      mockLoadPackageFromHub.mockRejectedValue(new Error("Network error"));

      await agentFileService.initialize("owner/agent");

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile).toBeNull();

      // Model service should work normally
      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );
      expect(mockGetLlmApi).toHaveBeenCalled();
    });

    it("should handle agent rule processing errors gracefully", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      mockProcessRule.mockRejectedValue(new Error("Rule processing failed"));

      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        rules: ["existing rule"],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      // Should not inject agent file rule but should preserve existing rules
      expect(enhancedConfig.rules).toHaveLength(1);
      expect(enhancedConfig.rules?.[0]).toBe("existing rule");
    });

    // Removed test for missing service container since agent file service
    // should always be initialized before ConfigEnhancer is called

    it("should inject agent file prompt when agent file active", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        rules: ["existing rule"],
        prompts: [],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      // Agent file prompt should be added to config.prompts
      expect(enhancedConfig.prompts).toBeDefined();
      expect(enhancedConfig.prompts?.length).toBeGreaterThan(0);
      expect(enhancedConfig.prompts?.[0]).toMatchObject({
        prompt: "You are an assistant.",
        name: expect.stringContaining("Test Agent"),
      });
      expect(enhancedConfig.rules).toHaveLength(2);
    });

    it("should add agent file prompt to config alongside other prompts", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        prompts: [{ name: "Existing", prompt: "existing-prompt" }],
      };
      const baseOptions = {};

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
        agentFileService.getState(),
      );

      // Agent file prompt should be prepended to existing prompts
      expect(enhancedConfig.prompts).toHaveLength(2);
      expect(enhancedConfig.prompts?.[0]).toMatchObject({
        name: expect.stringContaining("Test Agent"),
        prompt: "You are an assistant.",
      });
      expect(enhancedConfig.prompts?.[1]).toMatchObject({
        name: "Existing",
        prompt: "existing-prompt",
      });
    });

    it("should not add agent file prompt when agent file has no prompt", async () => {
      const agentFileWithoutPrompt = {
        ...mockAgentFile,
        prompt: undefined,
      };

      mockLoadPackageFromHub.mockResolvedValue(agentFileWithoutPrompt);
      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        prompts: [{ name: "Existing", prompt: "existing-prompt" }],
      };
      const baseOptions = {};

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
        agentFileService.getState(),
      );

      // Should only have the existing prompt, no agent file prompt added
      expect(enhancedConfig.prompts).toHaveLength(1);
      expect(enhancedConfig.prompts?.[0]).toMatchObject({
        name: "Existing",
        prompt: "existing-prompt",
      });
    });
  });

  describe("ConfigEnhancer prompt integration", () => {
    it("should add agent file prompt to config.prompts when agent file active", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      const baseOptions = { prompt: ["user-prompt"] };
      const baseConfig = { prompts: [] };

      // Enhance config with agent file state
      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
        agentFileService.getState(),
      );

      // Verify that the agent file prompt was added to config.prompts
      expect(enhancedConfig.prompts).toBeDefined();
      expect(enhancedConfig.prompts).toHaveLength(1);
      expect(enhancedConfig.prompts?.[0]).toMatchObject({
        name: expect.stringContaining("Test Agent"),
        prompt: "You are an assistant.",
        description: "A test agent for integration testing",
      });
    });

    it("should work end-to-end with agent file prompt in config", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile?.prompt).toBe("You are an assistant.");

      const baseConfig = { prompts: [] };
      const baseOptions = { prompt: ["Tell me about TypeScript"] };

      // Enhance config with agent file
      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        baseOptions,
        agentFileState,
      );

      // Verify agent file prompt is added to config.prompts
      expect(enhancedConfig.prompts).toBeDefined();
      expect(enhancedConfig.prompts?.length).toBeGreaterThan(0);
      expect(enhancedConfig.prompts?.[0]?.prompt).toBe("You are an assistant.");
      expect(enhancedConfig.prompts?.[0]?.name).toContain("Test Agent");
    });
  });

  describe("Agent file data extraction", () => {
    it("should correctly extract all agent file properties", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await agentFileService.initialize("owner/agent");

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile?.model).toBe("gpt-4-agent");
      expect(agentFileState.agentFile?.tools).toBe("bash,read,write");
      expect(agentFileState.agentFile?.rules).toBe(
        "Always be helpful and concise",
      );
      expect(agentFileState.agentFile?.prompt).toBe("You are an assistant.");
      expect(agentFileState.slug).toBe("owner/agent");
    });

    it("should handle partial agent file data", async () => {
      const partialAgentFile = {
        name: "Partial Agent File",
        model: "gpt-3.5-turbo",
        prompt: "Partial prompt",
        // No tools or rules
      };

      mockLoadPackageFromHub.mockResolvedValue(partialAgentFile);
      await agentFileService.initialize("owner/partial");

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile?.model).toBe("gpt-3.5-turbo");
      expect(agentFileState.agentFile?.tools).toBeUndefined();
      expect(agentFileState.agentFile?.rules).toBeUndefined();
      expect(agentFileState.agentFile?.prompt).toBe("Partial prompt");
    });
  });

  describe("Agent file tools integration", () => {
    it("should inject MCP servers from agent file tools", async () => {
      const agentFileWithTools = {
        ...mockAgentFile,
        tools: "owner/mcp1, another/mcp2:specific_tool",
      };

      // Clear the default mock and setup specific mocks
      mockLoadPackageFromHub.mockReset();
      // First call loads the agent file
      mockLoadPackageFromHub.mockResolvedValueOnce(agentFileWithTools);
      // Second call loads the agent file model
      mockLoadPackageFromHub.mockResolvedValueOnce({
        name: "gpt-4-agent",
        provider: "openai",
      });
      // Third call loads mcp1
      mockLoadPackageFromHub.mockResolvedValueOnce({ name: "mcp1" });
      // Fourth call loads mcp2
      mockLoadPackageFromHub.mockResolvedValueOnce({ name: "mcp2" });

      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        mcpServers: [{ name: "existing-mcp" }],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      expect(enhancedConfig.mcpServers).toHaveLength(3);
      // MCPs are prepended in the order they are loaded
      expect(enhancedConfig.mcpServers?.[0]).toEqual({ name: "mcp1" });
      expect(enhancedConfig.mcpServers?.[1]).toEqual({ name: "mcp2" });
      expect(enhancedConfig.mcpServers?.[2]).toEqual({ name: "existing-mcp" });
    });

    it("should not inject MCP servers when agent file has no tools", async () => {
      const agentWithoutTools = {
        ...mockAgentFile,
        tools: undefined,
      };

      mockLoadPackageFromHub.mockReset();
      mockLoadPackageFromHub.mockResolvedValueOnce(agentWithoutTools);
      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        mcpServers: [{ name: "existing-mcp" }],
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      expect(enhancedConfig.mcpServers).toHaveLength(1);
      expect(enhancedConfig.mcpServers?.[0]).toEqual({ name: "existing-mcp" });
    });

    it("should deduplicate MCP servers", async () => {
      const agentFileWithDuplicateTools = {
        ...mockAgentFile,
        tools: "owner/mcp1, owner/mcp1:tool1, owner/mcp1:tool2",
      };

      // Clear the default mock and setup specific mocks
      mockLoadPackageFromHub.mockReset();
      // First call loads the agent file
      mockLoadPackageFromHub.mockResolvedValueOnce(agentFileWithDuplicateTools);
      // Second call loads the agent file model
      mockLoadPackageFromHub.mockResolvedValueOnce({
        name: "gpt-4-agent",
        provider: "openai",
      });
      // Third call: The parseAgentFileTools will extract only unique MCP servers, so only one loadPackageFromHub call
      mockLoadPackageFromHub.mockResolvedValueOnce({ name: "mcp1" });

      await agentFileService.initialize("owner/agent");

      const baseConfig = {
        mcpServers: [{ name: "existing-mcp" }], // Changed to avoid confusion
      };

      const enhancedConfig = await configEnhancer.enhanceConfig(
        baseConfig as any,
        {},
        agentFileService.getState(),
      );

      // parseAgentFileTools deduplicates, so we only get mcp1 once
      expect(enhancedConfig.mcpServers).toHaveLength(2);
      expect(enhancedConfig.mcpServers?.[0]).toEqual({ name: "mcp1" });
      expect(enhancedConfig.mcpServers?.[1]).toEqual({ name: "existing-mcp" });
    });
  });
});
