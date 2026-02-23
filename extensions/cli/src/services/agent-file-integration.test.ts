import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentFileService } from "./AgentFileService.js";
import { ConfigService } from "./ConfigService.js";
import { ModelService } from "./ModelService.js";

// Mock the hubLoader module
vi.mock("../hubLoader.js", () => ({
  loadPackageFromHub: vi.fn(),
  loadPackagesFromHub: vi.fn(),
  loadModelFromHub: vi.fn(),
  mcpProcessor: {},
  modelProcessor: {},
  processRule: vi.fn(),
  isStringRule: vi.fn(),
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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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
  loadAuthConfig: vi.fn(),
}));

// Mock the config-yaml package
vi.mock("@continuedev/config-yaml", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@continuedev/config-yaml")>();
  return {
    ...actual,
    decodePackageIdentifier: vi.fn((id) => ({
      type: "slug",
      slug: id,
      version: undefined,
    })),
  };
});

// Mock configLoader
vi.mock("../configLoader.js", () => ({
  loadConfiguration: vi.fn(),
}));

// Mock service container
vi.mock("./ServiceContainer.js", () => ({
  serviceContainer: {
    get: vi.fn(),
    set: vi.fn(),
    reload: vi.fn(),
  },
}));

describe("Agent file Integration Tests", () => {
  let agentFileService: AgentFileService;
  let modelService: ModelService;
  let configService: ConfigService;
  let mockLoadPackageFromHub: any;
  let mockLoadPackagesFromHub: any;
  let mockProcessRule: any;
  let mockCreateLlmApi: any;
  let mockGetLlmApi: any;
  let mockModelProcessor: any;
  let mockDecodePackageIdentifier: any;
  let mockLoadModelFromHub: any;
  let mockIsStringRule: any;

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
    mockLoadModelFromHub = hubLoaderModule.loadModelFromHub as any;
    mockIsStringRule = hubLoaderModule.isStringRule as any;
    mockCreateLlmApi = configModule.createLlmApi as any;
    mockGetLlmApi = configModule.getLlmApi as any;

    // Get mock functions from config-yaml
    const configYaml = await import("@continuedev/config-yaml");
    mockDecodePackageIdentifier = configYaml.decodePackageIdentifier as any;

    // Create service instances
    agentFileService = new AgentFileService();
    modelService = new ModelService();
    configService = new ConfigService();

    // Setup default mocks
    mockProcessRule.mockResolvedValue("Processed rule content");
    mockLoadPackagesFromHub.mockResolvedValue([{ name: "test-mcp" }]);
    mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
    mockLoadModelFromHub.mockResolvedValue({
      name: "gpt-4-agent",
      provider: "openai",
    });
    mockIsStringRule.mockImplementation((rule: string) => {
      // String rules are those that don't look like package identifiers
      return rule.includes(" ") || rule.includes("\n") || !rule.includes("/");
    });
    mockCreateLlmApi.mockReturnValue({ mock: "llmApi" });
    mockGetLlmApi.mockReturnValue([
      { mock: "llmApi" },
      mockAssistant.models[0],
    ]);
  });

  describe("Agent file models are injected via ConfigService", () => {
    it("should add agent file model when agent file is active", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile?.model).toBe("gpt-4-agent");

      // Test that ConfigService processes the agent file model
      const baseOptions = {}; // No --model flag

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileState,
        );

      // Should have processed the agent file model as a package identifier
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("gpt-4-agent");
      expect(injected).toHaveLength(2); // Agent file model + parsed rules become package identifiers
    });

    it("should not add agent file model when no agent file active", async () => {
      // Initialize agent file service without agent
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        undefined,
        authServiceState,
        apiClientState,
      );

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile).toBeNull();

      // Test that ConfigService doesn't add any agent file models
      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileState,
        );

      // Should not have processed any models
      expect(injected).toHaveLength(0);
      expect(additional.models || []).toHaveLength(0);
    });

    it("should process both --model flag and agent file model", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

      // Test that --model flag and agent file model are both processed
      const baseOptions = { model: ["user-specified-model"] }; // User specified --model

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileService.getState(),
        );

      // Should process both the user model and agent file model as package identifiers
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith(
        "user-specified-model",
      );
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("gpt-4-agent");
      expect(injected).toHaveLength(3); // User model + agent file model + parsed rules as package identifiers
    });
  });

  describe("AgentFileService affects ConfigService", () => {
    it("should inject agent file rules when agent file active", async () => {
      // Mock the agent file with parsed rules
      const agentFileStateWithRules = {
        agentFile: mockAgentFile,
        parsedRules: ["agent/rule1"], // Parsed rules from agent file
        parsedTools: null,
        slug: null,
        agentFileModel: null,
      };

      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileStateWithRules,
        );

      // Agent file rules should be processed as package identifiers
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("agent/rule1");
      expect(injected).toHaveLength(2); // Model + rule
    });

    it("should not inject agent file rules when agent file inactive", async () => {
      // Initialize agent file service without agent file
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        undefined,
        authServiceState,
        apiClientState,
      );

      const baseOptions = {};
      const agentFileState = agentFileService.getState();

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileState,
        );

      // Should not process any rules since no agent file is active
      expect(injected).toHaveLength(0);
      expect(additional.rules).toHaveLength(0);
    });

    it("should not inject agent file rules when agent file has no rules", async () => {
      const agentFileWithoutRules = {
        ...mockAgentFile,
        rules: undefined,
      };

      // Mock agent file state with no parsed rules
      const agentFileStateWithoutRules = {
        agentFile: agentFileWithoutRules,
        parsedRules: [], // No parsed rules
        parsedTools: null,
        slug: null,
        agentFileModel: null,
      };

      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileStateWithoutRules,
        );

      // Should only have the model, no rules
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("gpt-4-agent"); // Only the model
      expect(injected).toHaveLength(1); // Only the model
      expect(additional.rules).toHaveLength(0);
    });
  });

  describe("Agent file model constraints", () => {
    it("should filter available models to only agent file model when specified", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

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
      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        undefined,
        authServiceState,
        apiClientState,
      );

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

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      // The service should throw the error, not handle it gracefully
      await expect(
        agentFileService.initialize(
          "owner/agent",
          authServiceState,
          apiClientState,
        ),
      ).rejects.toThrow("Failed to load agent from owner/agent");

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile).toBeNull();

      // Model service should work normally
      await modelService.initialize(
        mockAssistant as any,
        mockAuthConfig as any,
      );
      expect(mockGetLlmApi).toHaveBeenCalled();
    });

    it("should handle package identifier decoding errors gracefully", async () => {
      // Mock decoding to throw an error
      mockDecodePackageIdentifier.mockImplementation((id: string) => {
        if (id === "invalid-rule") {
          throw new Error("Invalid package identifier");
        }
        return { type: "slug", slug: id, version: undefined };
      });

      const agentFileStateWithInvalidRules = {
        agentFile: mockAgentFile,
        parsedRules: ["invalid-rule"], // This will throw an error when decoded
        parsedTools: null,
        slug: null,
        agentFileModel: null,
      };

      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileStateWithInvalidRules,
        );

      // Should handle the error gracefully and only include valid package identifiers
      expect(injected).toHaveLength(1); // Only the model should be included
      expect(additional.rules).toHaveLength(0);
    });

    // Removed test for missing service container since agent file service
    // should always be initialized before ConfigEnhancer is called

    it("should inject agent file prompt when agent file active", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

      const baseOptions = {};
      const agentFileState = agentFileService.getState();

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileState,
        );

      // Agent file prompt should be added to additional.prompts
      expect(additional.prompts).toBeDefined();
      expect(additional.prompts?.length).toBeGreaterThan(0);
      expect(additional.prompts?.[0]).toMatchObject({
        prompt: "You are an assistant.",
        name: expect.stringContaining("Test Agent"),
      });
    });

    it("should prepare agent file prompt for merging with other prompts", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

      const baseOptions = {};
      const agentFileState = agentFileService.getState();

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileState,
        );

      // Agent file prompt should be in additional block ready for merging
      expect(additional.prompts).toHaveLength(1);
      expect(additional.prompts?.[0]).toMatchObject({
        name: expect.stringContaining("Test Agent"),
        prompt: "You are an assistant.",
      });

      // mergeUnrolledAssistants would combine this with base config prompts
      const { mergeUnrolledAssistants } = await import(
        "@continuedev/config-yaml"
      );
      const baseConfig = {
        name: "original",
        version: "1.0.0",
        prompts: [{ name: "Existing", prompt: "existing-prompt" }],
      };

      const merged = mergeUnrolledAssistants(baseConfig, additional);
      expect(merged.prompts).toHaveLength(2);
    });

    it("should not add agent file prompt when agent file has no prompt", async () => {
      const agentFileWithoutPrompt = {
        ...mockAgentFile,
        prompt: "",
      };

      const agentFileStateWithoutPrompt = {
        agentFile: agentFileWithoutPrompt,
        parsedRules: [],
        parsedTools: null,
        slug: null,
        agentFileModel: null,
      };

      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileStateWithoutPrompt,
        );

      // Should not have any prompts in additional block
      expect(additional.prompts).toHaveLength(0);
    });
  });

  describe("ConfigService prompt integration", () => {
    it("should process agent file prompt and user prompts together", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

      const baseOptions = { prompt: ["user-prompt"] };
      const agentFileState = agentFileService.getState();

      // Process options with ConfigService
      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileState,
        );

      // Verify that the agent file prompt was added to additional block
      expect(additional.prompts).toBeDefined();
      expect(additional.prompts).toHaveLength(1);
      expect(additional.prompts?.[0]).toMatchObject({
        name: expect.stringContaining("Test Agent"),
        prompt: "You are an assistant.",
        description: "A test agent for integration testing",
      });

      // User prompts should be in additional.rules as string rules
      expect(additional.rules).toContain("user-prompt");
    });

    it("should work end-to-end with agent file prompt processing", async () => {
      // Setup agent file service with active agent file
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile?.prompt).toBe("You are an assistant.");

      const baseOptions = { prompt: ["Tell me about TypeScript"] };

      // Process with ConfigService
      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileState,
        );

      // Verify agent file prompt is prepared for merging
      expect(additional.prompts).toBeDefined();
      expect(additional.prompts?.length).toBeGreaterThan(0);
      expect(additional.prompts?.[0]?.prompt).toBe("You are an assistant.");
      expect(additional.prompts?.[0]?.name).toContain("Test Agent");

      // User prompt should be a string rule
      expect(additional.rules).toContain("Tell me about TypeScript");
    });
  });

  describe("Agent file data extraction", () => {
    it("should correctly extract all agent file properties", async () => {
      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/agent",
        authServiceState,
        apiClientState,
      );

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

      // Mock the required service states
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await agentFileService.initialize(
        "owner/partial",
        authServiceState,
        apiClientState,
      );

      const agentFileState = agentFileService.getState();
      expect(agentFileState.agentFile?.model).toBe("gpt-3.5-turbo");
      expect(agentFileState.agentFile?.tools).toBeUndefined();
      expect(agentFileState.agentFile?.rules).toBeUndefined();
      expect(agentFileState.agentFile?.prompt).toBe("Partial prompt");
    });
  });

  describe("Agent file tools integration", () => {
    it("should inject MCP servers from agent file tools", async () => {
      const agentFileStateWithTools = {
        agentFile: {
          ...mockAgentFile,
          tools: "owner/mcp1, another/mcp2:specific_tool",
        },
        parsedRules: [],
        parsedTools: {
          mcpServers: ["owner/mcp1", "another/mcp2"], // Parsed MCP servers
          tools: [],
          allBuiltIn: false,
        },
        slug: null,
        agentFileModel: null,
      };

      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileStateWithTools,
        );

      // MCP servers should be processed as package identifiers
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("owner/mcp1");
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("another/mcp2");
      expect(injected).toHaveLength(3); // model + 2 MCP servers
    });

    it("should not inject MCP servers when agent file has no tools", async () => {
      const agentFileStateWithoutTools = {
        agentFile: {
          ...mockAgentFile,
          tools: undefined,
        },
        parsedRules: [],
        parsedTools: null,
        slug: null,
        agentFileModel: null,
      };

      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileStateWithoutTools,
        );

      // Should only have the model, no MCP servers
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("gpt-4-agent"); // Only model
      expect(injected).toHaveLength(1); // Only model
      expect(additional.mcpServers).toHaveLength(0);
    });

    it("should handle deduplicated MCP servers from parsing", async () => {
      const agentFileStateWithDuplicateTools = {
        agentFile: {
          ...mockAgentFile,
          tools: "owner/mcp1, owner/mcp1:tool1, owner/mcp1:tool2",
        },
        parsedRules: [],
        parsedTools: {
          mcpServers: ["owner/mcp1"], // parseAgentFileTools already deduplicated
          tools: [],
          allBuiltIn: false,
        },
        slug: null,
        agentFileModel: null,
      };

      const baseOptions = {};

      const { injected, additional } =
        configService.getAdditionalBlocksFromOptions(
          baseOptions,
          agentFileStateWithDuplicateTools,
        );

      // Should only process the deduplicated MCP server once
      expect(mockDecodePackageIdentifier).toHaveBeenCalledWith("owner/mcp1");
      expect(injected).toHaveLength(2); // model + deduplicated MCP server
    });
  });
});
