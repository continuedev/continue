import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AgentFileService,
  EMPTY_AGENT_FILE_STATE,
} from "./AgentFileService.js";

// Mock fs module
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    default: {
      readFileSync: vi.fn(),
    },
    readFileSync: vi.fn(),
  };
});

// Mock path module
vi.mock("path", async () => {
  const actual = await vi.importActual<typeof import("path")>("path");
  return {
    ...actual,
    default: {
      ...actual,
      resolve: vi.fn(),
    },
    resolve: vi.fn(),
  };
});

// Mock url module
vi.mock("url", async () => {
  const actual = await vi.importActual<typeof import("url")>("url");
  return {
    ...actual,
    fileURLToPath: vi.fn(),
  };
});

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
    info: vi.fn(),
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
  let mockReadFileSync: any;
  let mockPathResolve: any;
  let mockFileURLToPath: any;

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

    // Get fs mocks
    mockReadFileSync = vi.mocked(fs.readFileSync);
    mockPathResolve = vi.mocked(path.resolve);
    mockFileURLToPath = vi.mocked(fileURLToPath);

    // Create service instance
    agentFileService = new AgentFileService();

    // Setup default mocks for initialization tests
    // For getAgentFile tests, mocks should be set in each test
    mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
    mockLoadModelFromHub.mockResolvedValue({
      name: "gpt-4-agent",
      provider: "openai",
    });
    // Default file system mocks
    mockPathResolve.mockImplementation((p: string) => `/resolved/${p}`);
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
      // Also make file reading fail so there's no fallback
      mockReadFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

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
      ).rejects.toThrow("Failed to load agent from owner/agent");

      const state = agentFileService.getState();
      expect(state.agentFile).toBeNull();
    });

    it("should throw error when both hub and file loading fail", async () => {
      mockLoadPackageFromHub.mockRejectedValue(new Error("Hub error"));
      mockReadFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

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
      ).rejects.toThrow("Failed to load agent from invalid-slug");
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

  describe("getAgentFile", () => {
    const mockFileContent = `---
name: Test Agent
model: gpt-4
tools: bash,read,write
rules: Be helpful
---
You are a helpful agent`;

    describe("hub slug loading", () => {
      it("should load from hub when path is valid slug format (owner/agent)", async () => {
        mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

        const result = await agentFileService.getAgentFile("owner/agent");

        expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
          "owner/agent",
          expect.objectContaining({
            type: "agentFile",
            expectedFileExtensions: [".md"],
          }),
        );
        expect(result).toEqual(mockAgentFile);
        expect(mockReadFileSync).not.toHaveBeenCalled();
      });

      it("should load from hub when slug has valid two-part format", async () => {
        mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

        const result =
          await agentFileService.getAgentFile("continue/dev-agent");

        expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
          "continue/dev-agent",
          expect.any(Object),
        );
        expect(result).toEqual(mockAgentFile);
      });

      it("should fallback to file path when hub loading fails for slug-like path with .md extension", async () => {
        mockLoadPackageFromHub.mockRejectedValue(new Error("Hub error"));
        mockPathResolve.mockImplementation((p: string) => `/resolved/${p}`);
        mockReadFileSync.mockReturnValue(mockFileContent);

        const result = await agentFileService.getAgentFile("owner/agent.md");

        expect(mockLoadPackageFromHub).toHaveBeenCalled(); // Two-part paths try hub first
        expect(mockPathResolve).toHaveBeenCalledWith("owner/agent.md");
        expect(mockReadFileSync).toHaveBeenCalledWith(
          "/resolved/owner/agent.md",
          "utf-8",
        );
        expect(result).toBeDefined();
        expect(result.name).toBe("Test Agent");
      });
    });

    describe("file:/ URL loading", () => {
      it("should load from file:/ URL using fileURLToPath", async () => {
        const fileUrl = "file:///home/user/agent.md";
        const resolvedPath = "/home/user/agent.md";
        mockFileURLToPath.mockReturnValue(resolvedPath);
        mockReadFileSync.mockReturnValue(mockFileContent);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile(fileUrl);

        expect(mockFileURLToPath).toHaveBeenCalledWith(fileUrl);
        expect(mockReadFileSync).toHaveBeenCalledWith(resolvedPath, "utf-8");
        expect(result.name).toBe("Test Agent");
        expect(result.model).toBe("gpt-4");
        expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
      });

      it("should handle file:/ prefix with single slash", async () => {
        const fileUrl = "file:/path/to/agent.md";
        const resolvedPath = "/path/to/agent.md";
        mockFileURLToPath.mockReturnValue(resolvedPath);
        mockReadFileSync.mockReturnValue(mockFileContent);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile(fileUrl);

        expect(mockFileURLToPath).toHaveBeenCalledWith(fileUrl);
        expect(mockReadFileSync).toHaveBeenCalledWith(resolvedPath, "utf-8");
        expect(result).toBeDefined();
      });
    });

    describe("relative path loading", () => {
      it("should load from relative path", async () => {
        const relativePath = "./agents/my-agent.md";
        mockPathResolve.mockReturnValue("/absolute/path/agents/my-agent.md");
        mockReadFileSync.mockReturnValue(mockFileContent);
        // Reset hub loading mock to ensure it's not called
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile(relativePath);

        expect(mockPathResolve).toHaveBeenCalledWith(relativePath);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          "/absolute/path/agents/my-agent.md",
          "utf-8",
        );
        expect(result.name).toBe("Test Agent");
        expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
      });

      it("should load from absolute path", async () => {
        const absolutePath = "/home/user/agents/agent.md";
        mockPathResolve.mockReturnValue(absolutePath);
        mockReadFileSync.mockReturnValue(mockFileContent);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile(absolutePath);

        expect(mockPathResolve).toHaveBeenCalledWith(absolutePath);
        expect(mockReadFileSync).toHaveBeenCalledWith(absolutePath, "utf-8");
        expect(result).toBeDefined();
      });

      it("should handle paths with special characters", async () => {
        const specialPath = "./agents/my agent (v2).md";
        mockPathResolve.mockReturnValue("/resolved/agents/my agent (v2).md");
        mockReadFileSync.mockReturnValue(mockFileContent);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile(specialPath);

        expect(mockPathResolve).toHaveBeenCalledWith(specialPath);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          "/resolved/agents/my agent (v2).md",
          "utf-8",
        );
        expect(result).toBeDefined();
      });
    });

    describe("path format edge cases", () => {
      it("should treat single-part path as file path, not hub slug", async () => {
        const singlePath = "agent.md";
        mockPathResolve.mockReturnValue("/resolved/agent.md");
        mockReadFileSync.mockReturnValue(mockFileContent);

        const result = await agentFileService.getAgentFile(singlePath);

        expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
        expect(mockPathResolve).toHaveBeenCalledWith(singlePath);
        expect(mockReadFileSync).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it("should treat three-part path as file path, not hub slug", async () => {
        const threePath = "path/to/agent.md";
        mockPathResolve.mockReturnValue("/resolved/path/to/agent.md");
        mockReadFileSync.mockReturnValue(mockFileContent);

        const result = await agentFileService.getAgentFile(threePath);

        expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
        expect(mockPathResolve).toHaveBeenCalledWith(threePath);
        expect(mockReadFileSync).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it("should not treat two-part path with empty part as hub slug", async () => {
        const emptyPartPath = "owner/"; // Empty second part

        // With the new behavior, non-markdown paths throw errors
        await expect(
          agentFileService.getAgentFile(emptyPartPath),
        ).rejects.toThrow("Not a markdown file");

        expect(mockLoadPackageFromHub).not.toHaveBeenCalled(); // Empty part means no hub attempt
      });

      it("should not treat path starting with slash as hub slug", async () => {
        const slashPath = "/owner/agent.md";
        mockPathResolve.mockReturnValue(slashPath);
        mockReadFileSync.mockReturnValue(mockFileContent);

        const result = await agentFileService.getAgentFile(slashPath);

        expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
        expect(mockPathResolve).toHaveBeenCalledWith(slashPath);
        expect(result).toBeDefined();
      });
    });

    describe("error handling", () => {
      it("should throw error with context when file reading fails", async () => {
        const testPath = "./missing-file.md";
        mockPathResolve.mockReturnValue("/resolved/missing-file.md");
        mockReadFileSync.mockImplementation(() => {
          throw new Error("ENOENT: no such file or directory");
        });
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        await expect(agentFileService.getAgentFile(testPath)).rejects.toThrow(
          "Failed to load agent from ./missing-file.md",
        );
        await expect(agentFileService.getAgentFile(testPath)).rejects.toThrow(
          "ENOENT: no such file or directory",
        );
      });

      it("should throw error when parseAgentFile fails", async () => {
        const invalidContent = "invalid yaml content {{{{";
        mockPathResolve.mockReturnValue("/resolved/invalid.md");
        mockReadFileSync.mockReturnValue(invalidContent);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        await expect(
          agentFileService.getAgentFile("./invalid.md"),
        ).rejects.toThrow("Failed to load agent from ./invalid.md");
      });

      it("should throw error when file reading fails for markdown path", async () => {
        mockLoadPackageFromHub.mockRejectedValue(new Error("Hub error"));
        mockPathResolve.mockReturnValue("/resolved/owner/agent.md");
        mockReadFileSync.mockImplementation(() => {
          throw new Error("File not found");
        });

        await expect(
          agentFileService.getAgentFile("owner/agent.md"),
        ).rejects.toThrow("Failed to load agent from owner/agent.md");
        await expect(
          agentFileService.getAgentFile("owner/agent.md"),
        ).rejects.toThrow("File not found");
      });

      it("should re-throw hub error for non-markdown hub slugs", async () => {
        // Reset mock to clear any queued values from previous tests
        mockLoadPackageFromHub.mockReset();
        mockLoadPackageFromHub.mockRejectedValue(new Error("Hub error"));

        await expect(
          agentFileService.getAgentFile("owner/agent"),
        ).rejects.toThrow("Failed to load agent from owner/agent");
        await expect(
          agentFileService.getAgentFile("owner/agent"),
        ).rejects.toThrow("Hub error");
      });

      it("should handle permission errors when reading files", async () => {
        mockPathResolve.mockReturnValue("/restricted/file.md");
        mockReadFileSync.mockImplementation(() => {
          throw new Error("EACCES: permission denied");
        });
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        await expect(
          agentFileService.getAgentFile("./restricted-file.md"),
        ).rejects.toThrow("Failed to load agent from ./restricted-file.md");
        await expect(
          agentFileService.getAgentFile("./restricted-file.md"),
        ).rejects.toThrow("EACCES: permission denied");
      });
    });

    describe("content parsing", () => {
      it("should correctly parse agent file with all fields", async () => {
        const fullContent = `---
name: Full Agent
description: A complete agent
model: gpt-4
tools: bash,read,write
rules: Always be helpful, Be concise
---
You are a helpful assistant`;

        mockPathResolve.mockReturnValue("/resolved/full.md");
        mockReadFileSync.mockReturnValue(fullContent);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile("./full.md");

        expect(result.name).toBe("Full Agent");
        expect(result.description).toBe("A complete agent");
        expect(result.model).toBe("gpt-4");
        expect(result.tools).toBe("bash,read,write");
        expect(result.rules).toBe("Always be helpful, Be concise");
        expect(result.prompt).toBe("You are a helpful assistant");
      });

      it("should parse agent file with minimal required fields", async () => {
        const minimalContent = `---
name: Minimal Agent
---
Basic prompt`;

        mockPathResolve.mockReturnValue("/resolved/minimal.md");
        mockReadFileSync.mockReturnValue(minimalContent);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile("./minimal.md");

        expect(result.name).toBe("Minimal Agent");
        expect(result.prompt).toBe("Basic prompt");
        expect(result.model).toBeUndefined();
        expect(result.tools).toBeUndefined();
        expect(result.rules).toBeUndefined();
      });

      it("should handle UTF-8 encoded content", async () => {
        const utf8Content = `---
name: Agent with émojis 🚀
---
Héllo wörld`;

        mockPathResolve.mockReturnValue("/resolved/utf8.md");
        mockReadFileSync.mockReturnValue(utf8Content);
        // Make hub loading fail so it falls back to file system
        mockLoadPackageFromHub.mockRejectedValueOnce(
          new Error("Not a hub slug"),
        );

        const result = await agentFileService.getAgentFile("./utf8.md");

        expect(result.name).toBe("Agent with émojis 🚀");
        expect(result.prompt).toBe("Héllo wörld");
        expect(mockReadFileSync).toHaveBeenCalledWith(
          "/resolved/utf8.md",
          "utf-8",
        );
      });
    });
  });
});
