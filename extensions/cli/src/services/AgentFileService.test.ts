import { Mock, vi } from "vitest";

import { agentFileProcessor } from "../hubLoader.js";

import { AgentFileService } from "./AgentFileService.js";

// Mock the hubLoader module
vi.mock("../hubLoader.js", () => ({
  loadPackageFromHub: vi.fn(),
  HubPackageProcessor: vi.fn(),
  agentFileProcessor: {
    type: "agent-file",
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

describe("AgentFileService", () => {
  let service: AgentFileService;
  let mockLoadPackageFromHub: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new AgentFileService();

    // Get the mock function
    const hubLoaderModule = await import("../hubLoader.js");
    mockLoadPackageFromHub = hubLoaderModule.loadPackageFromHub as any;
  });

  describe("initialization", () => {
    it("should initialize with inactive state when no agent file provided", async () => {
      const state = await service.initialize();

      expect(state).toEqual({
        agentFile: null,
        slug: null,
        agentFileModelName: null,
        agentFileService: service,
      });
    });

    it("should initialize with inactive state when agent slug is empty string", async () => {
      const state = await service.initialize("");

      expect(state).toEqual({
        agentFile: null,
        slug: null,
        agentFileModelName: null,
        agentFileService: service,
      });
    });

    it("should reject invalid agent slug format", async () => {
      const state = await service.initialize("invalid-slug");

      expect(state).toEqual({
        agentFile: null,
        slug: null,
        agentFileModelName: null,
        agentFileService: service,
      });

      // Should not call loadPackageFromHub with invalid slug
      expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
    });

    it("should reject agent slug with too many parts", async () => {
      const state = await service.initialize("owner/package/extra");

      expect(state).toEqual({
        agentFile: null,
        slug: null,
        agentFileModelName: null,
        agentFileService: service,
      });

      expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
    });

    it("should load valid agent file successfully", async () => {
      const mockAgentFile = {
        name: "Test Agent",
        description: "A test agent",
        model: "gpt-4",
        tools: "bash,read,write",
        rules: "Be helpful",
        prompt: "You are a helpful assistant.",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      const state = await service.initialize("owner/package");

      expect(state).toEqual({
        agentFile: mockAgentFile,
        slug: "owner/package",
        agentFileModelName: null,
        agentFileService: service,
      });

      expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
        "owner/package",
        agentFileProcessor,
      );
    });

    it("should handle loading errors gracefully", async () => {
      mockLoadPackageFromHub.mockRejectedValue(new Error("Network error"));

      const state = await service.initialize("owner/package");

      expect(state).toEqual({
        agentFile: null,
        slug: null,
        agentFileModelName: null,
        agentFileService: service,
      });

      expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
        "owner/package",
        agentFileProcessor,
      );
    });

    it("should handle minimal agent file", async () => {
      const mockAgentFile = {
        name: "Minimal Agent File",
        prompt: "",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);

      const state = await service.initialize("owner/minimal");

      expect(state).toEqual({
        agentFile: mockAgentFile,
        slug: "owner/minimal",
        agentFileModelName: null,
        agentFileService: service,
      });
    });
  });

  describe("state getters", () => {
    beforeEach(async () => {
      const mockAgentFile = {
        name: "Test Agent",
        description: "A test Agent",
        model: "gpt-4",
        tools: "bash,read,write",
        rules: "Be helpful",
        prompt: "You are a helpful assistant.",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await service.initialize("owner/package");
    });

    it("should return agent file state", () => {
      const state = service.getState();
      expect(state.agentFile?.name).toBe("Test Agent");
      expect(state.slug).toBe("owner/package");
      expect(state.agentFile?.model).toBe("gpt-4");
      expect(state.agentFile?.tools).toBe("bash,read,write");
      expect(state.agentFile?.rules).toBe("Be helpful");
      expect(state.agentFile?.prompt).toBe("You are a helpful assistant.");
    });
  });

  describe("inactive agent file state", () => {
    beforeEach(() => {
      service.initialize();
    });

    it("should return inactive state when no agent file", () => {
      const state = service.getState();
      expect(state.agentFile).toBeNull();
      expect(state.slug).toBeNull();
    });
  });

  describe("partial agent file data", () => {
    it("should handle agent file with only name and prompt", async () => {
      const mockAgentFile = {
        name: "Simple Agent",
        prompt: "Simple prompt",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await service.initialize("owner/simple");

      const state = service.getState();
      expect(state.agentFile?.model).toBeUndefined();
      expect(state.agentFile?.tools).toBeUndefined();
      expect(state.agentFile?.rules).toBeUndefined();
      expect(state.agentFile?.prompt).toBe("Simple prompt");
    });

    it("should handle agent file with empty prompt", async () => {
      const mockAgentFile = {
        name: "Empty Prompt Agent",
        model: "gpt-3.5-turbo",
        prompt: "",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockAgentFile);
      await service.initialize("owner/empty");

      const state = service.getState();
      expect(state.agentFile?.model).toBe("gpt-3.5-turbo");
      expect(state.agentFile?.prompt).toBe("");
    });
  });
});

describe("agentFileProcessor", () => {
  it("should have correct type and extensions", () => {
    expect(agentFileProcessor.type).toBe("agent-file");
    expect(agentFileProcessor.expectedFileExtensions).toEqual([".md"]);
  });

  it("should parse agent file content correctly", () => {
    const content = `---
name: Test Agent
model: gpt-4
tools: bash,read
---
You are a helpful assistant.`;

    // Set up the mock to return expected result
    const expectedResult = {
      name: "Test Agent",
      model: "gpt-4",
      tools: "bash,read",
      prompt: "You are a helpful assistant.",
    };
    (agentFileProcessor.parseContent as Mock).mockReturnValue(expectedResult);

    const result = agentFileProcessor.parseContent(content, "test.md");
    expect(result).toEqual({
      name: "Test Agent",
      model: "gpt-4",
      tools: "bash,read",
      prompt: "You are a helpful assistant.",
    });
  });

  it("should validate agent file content", () => {
    const validAgentFile = {
      name: "Valid Agent",
      prompt: "Test prompt",
    };

    const invalidAgentFile = {
      prompt: "Test prompt",
      // Missing name
    };

    // Set up mock validation responses
    (agentFileProcessor.validateContent as Mock)
      .mockReturnValueOnce(true) // For valid agent file
      .mockReturnValueOnce(false); // For invalid agent file

    expect(agentFileProcessor.validateContent?.(validAgentFile)).toBe(true);
    expect(agentFileProcessor.validateContent?.(invalidAgentFile as any)).toBe(
      false,
    );
  });

  it("should validate agent file with empty name as invalid", () => {
    const invalidAgentFile = {
      name: "",
      prompt: "Test prompt",
    };

    // Mock validation to return false for empty name
    (agentFileProcessor.validateContent as Mock).mockReturnValue(false);

    expect(agentFileProcessor.validateContent?.(invalidAgentFile)).toBe(false);
  });
});
