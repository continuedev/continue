import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AgentFileService,
  EMPTY_AGENT_FILE_STATE,
} from "./AgentFileService.js";

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
  loadAuthConfig: vi.fn(),
}));

// Mock the config-yaml package
vi.mock("@continuedev/config-yaml", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@continuedev/config-yaml")>();
  return {
    ...actual,
  };
});

// Mock service container
vi.mock("./ServiceContainer.js", () => ({
  serviceContainer: {
    get: vi.fn(),
    set: vi.fn(),
    reload: vi.fn(),
  },
}));

describe("AgentFileService", () => {
  let agentFileService: AgentFileService;
  let mockLoadPackageFromHub: any;
  let mockLoadModelFromHub: any;

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
    mockLoadPackageFromHub = hubLoaderModule.loadPackageFromHub as any;
    mockLoadModelFromHub = hubLoaderModule.loadModelFromHub as any;

    // Create service instance
    agentFileService = new AgentFileService();

    // Setup default mocks
    mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
    mockLoadModelFromHub.mockResolvedValue({
      name: "gpt-4-agent",
      provider: "openai",
    });
  });

  describe("initialization", () => {
    it("should initialize with empty state when no agent slug provided", async () => {
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      const result = await agentFileService.initialize(
        undefined,
        authServiceState,
        apiClientState,
      );

      expect(result).toEqual(EMPTY_AGENT_FILE_STATE);
      expect(agentFileService.getState()).toEqual(EMPTY_AGENT_FILE_STATE);
      expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
    });

    it("should load and parse agent file when slug is provided", async () => {
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

      expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
        "owner/agent",
        expect.objectContaining({
          type: "agentFile",
          expectedFileExtensions: [".md"],
        }),
      );

      const state = agentFileService.getState();
      expect(state.agentFile).toEqual(mockAgentFile);
      expect(state.slug).toBe("owner/agent");
    });

    it("should load agent file model when model is specified", async () => {
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

      expect(mockLoadModelFromHub).toHaveBeenCalledWith("gpt-4-agent");

      const state = agentFileService.getState();
      expect(state.agentFileModel).toEqual({
        name: "gpt-4-agent",
        provider: "openai",
      });
    });
  });

  describe("rules parsing", () => {
    it("should parse rules when agent file has rules", async () => {
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

      const state = agentFileService.getState();
      expect(state.parsedRules).toBeDefined();
      expect(state.parsedRules).toEqual(["Always be helpful and concise"]);
    });

    it("should not parse rules when agent file has no rules", async () => {
      const agentFileWithoutRules = { ...mockAgentFile, rules: undefined };
      mockLoadPackageFromHub.mockResolvedValue(agentFileWithoutRules);

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

      const state = agentFileService.getState();
      expect(state.parsedRules).toBeNull();
    });
  });

  describe("tools parsing", () => {
    it("should parse tools when agent file has tools", async () => {
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

      const state = agentFileService.getState();
      expect(state.parsedTools).toBeDefined();
      expect(state.parsedTools?.mcpServers).toBeDefined();
      expect(Array.isArray(state.parsedTools?.mcpServers)).toBe(true);
    });

    it("should not parse tools when agent file has no tools", async () => {
      const agentFileWithoutTools = { ...mockAgentFile, tools: undefined };
      mockLoadPackageFromHub.mockResolvedValue(agentFileWithoutTools);

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

      const state = agentFileService.getState();
      expect(state.parsedTools).toBeNull();
    });
  });

  describe("model loading", () => {
    it("should not load model when agent file has no model", async () => {
      const agentFileWithoutModel = { ...mockAgentFile, model: undefined };
      mockLoadPackageFromHub.mockResolvedValue(agentFileWithoutModel);

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

      expect(mockLoadModelFromHub).not.toHaveBeenCalled();

      const state = agentFileService.getState();
      expect(state.agentFileModel).toBeNull();
    });

    it("should throw error when API client is not available for model loading", async () => {
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: null };

      await expect(
        agentFileService.initialize(
          "owner/agent",
          authServiceState,
          apiClientState,
        ),
      ).rejects.toThrow(
        "Cannot load agent model, failed to load api client service",
      );
    });
  });

  describe("error handling", () => {
    it("should throw error when agent loading fails", async () => {
      mockLoadPackageFromHub.mockRejectedValue(new Error("Network error"));

      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await expect(
        agentFileService.initialize(
          "owner/agent",
          authServiceState,
          apiClientState,
        ),
      ).rejects.toThrow("Network error");

      const state = agentFileService.getState();
      expect(state.agentFile).toBeNull();
    });

    it("should throw error for invalid agent slug format", async () => {
      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await expect(
        agentFileService.initialize(
          "invalid-slug",
          authServiceState,
          apiClientState,
        ),
      ).rejects.toThrow(
        'Invalid agent slug format. Expected "owner/package", got: invalid-slug',
      );
    });

    it("should throw error when model loading fails", async () => {
      mockLoadModelFromHub.mockRejectedValue(new Error("Model load error"));

      const authServiceState = {
        authConfig: mockAuthConfig,
        isAuthenticated: true,
      };
      const apiClientState = { apiClient: { mock: "apiClient" } };

      await expect(
        agentFileService.initialize(
          "owner/agent",
          authServiceState,
          apiClientState,
        ),
      ).rejects.toThrow("Model load error");
    });
  });

  describe("state management", () => {
    it("should return correct state after initialization", async () => {
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

      const state = agentFileService.getState();
      expect(state.agentFile).toEqual(mockAgentFile);
      expect(state.slug).toBe("owner/agent");
      expect(state.parsedRules).toEqual(["Always be helpful and concise"]);
      expect(state.parsedTools?.mcpServers).toBeDefined();
      expect(Array.isArray(state.parsedTools?.mcpServers)).toBe(true);
      expect(state.agentFileModel).toEqual({
        name: "gpt-4-agent",
        provider: "openai",
      });
    });

    it("should have correct dependencies", () => {
      const dependencies = agentFileService.getDependencies();
      expect(dependencies).toEqual(["auth", "apiClient"]);
    });
  });

  describe("partial data handling", () => {
    it("should handle agent file with missing optional properties", async () => {
      const partialAgentFile = {
        name: "Partial Agent File",
        model: "gpt-3.5-turbo",
        prompt: "Partial prompt",
        // No tools or rules
      };

      mockLoadPackageFromHub.mockResolvedValue(partialAgentFile);

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

      const state = agentFileService.getState();
      expect(state.agentFile?.name).toBe("Partial Agent File");
      expect(state.agentFile?.model).toBe("gpt-3.5-turbo");
      expect(state.agentFile?.prompt).toBe("Partial prompt");
      expect(state.agentFile?.tools).toBeUndefined();
      expect(state.agentFile?.rules).toBeUndefined();
      expect(state.parsedRules).toBeNull();
      expect(state.parsedTools).toBeNull();
    });
  });
});
