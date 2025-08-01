import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { AssistantConfig } from "@continuedev/sdk";
import { MCPService } from "./mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Mock the logger
jest.mock("./src/util/logger", () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the MCP SDK
const mockClient = {
  connect: jest.fn(),
  getServerCapabilities: jest.fn(() => ({ prompts: true, tools: true })),
  listPrompts: jest.fn(() => Promise.resolve({ prompts: [] })),
  listTools: jest.fn(() => Promise.resolve({ tools: [] })),
  callTool: jest.fn(() => Promise.resolve({})),
  close: jest.fn(() => Promise.resolve()),
};

jest.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: jest.fn(() => mockClient),
}));

jest.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: jest.fn(),
}));

describe("MCPService", () => {
  let mcpService: MCPService;
  let mockAssistant: AssistantConfig;

  beforeEach(() => {
    mcpService = new MCPService();
    mockAssistant = {
      name: "test-assistant",
      version: "1.0.0",
      mcpServers: [
        {
          name: "test-server",
          command: "echo",
          args: ["hello"],
          env: { TEST: "value" },
        },
      ],
    } as AssistantConfig;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with empty state", () => {
      const state = mcpService.getState();
      expect(state.isReady).toBe(false);
      expect(state.connections).toEqual([]);
      expect(state.toolCount).toBe(0);
      expect(state.promptCount).toBe(0);
    });

    it("should initialize with no servers", async () => {
      const emptyAssistant = {
        name: "empty",
        version: "1.0.0",
      } as AssistantConfig;
      const state = await mcpService.initialize(emptyAssistant);

      expect(state.isReady).toBe(true);
      expect(state.connections).toEqual([]);
      expect(state.toolCount).toBe(0);
      expect(state.promptCount).toBe(0);
    });

    it("should initialize and return immediately even with server configs", async () => {
      const state = await mcpService.initialize(mockAssistant);

      // Should return immediately with ready state
      expect(state.isReady).toBe(true);
      expect(state.mcpService).toBe(mcpService);
    });
  });

  describe("service management", () => {
    beforeEach(async () => {
      await mcpService.initialize(mockAssistant);
    });

    it("should provide service info", () => {
      const info = mcpService.getMCPInfo();
      expect(info).toHaveProperty("toolCount");
      expect(info).toHaveProperty("promptCount");
      expect(info).toHaveProperty("connectionCount");
    });

    it("should handle service updates", async () => {
      const newAssistant = {
        name: "updated-assistant",
        version: "1.0.0",
        mcpServers: [],
      } as AssistantConfig;

      const state = await mcpService.update(newAssistant);
      expect(state.isReady).toBe(true);
    });

    it("should get overall status with no connections", () => {
      const status = mcpService.getOverallStatus();
      expect(status.status).toBe("idle");
      expect(status.hasWarnings).toBe(false);
    });
  });

  describe("server management", () => {
    beforeEach(async () => {
      await mcpService.initialize(mockAssistant);
    });

    it("should handle restart all servers", async () => {
      await expect(mcpService.restartAllServers()).resolves.not.toThrow();
    });

    it("should handle stop all servers", async () => {
      await expect(mcpService.stopAllServers()).resolves.not.toThrow();
    });

    it("should handle server not found error", async () => {
      await expect(mcpService.restartServer("nonexistent")).rejects.toThrow(
        "Server nonexistent not found in configuration"
      );
    });

    it("should handle stop individual server", async () => {
      await expect(mcpService.stopServer("test-server")).resolves.not.toThrow();
    });

    it("should return null for nonexistent server info", () => {
      const info = mcpService.getServerInfo("nonexistent");
      expect(info).toBeNull();
    });
  });

  describe("tools and prompts", () => {
    beforeEach(async () => {
      await mcpService.initialize(mockAssistant);
    });

    it("should return empty arrays for tools and prompts initially", () => {
      const tools = mcpService.getTools();
      const prompts = mcpService.getPrompts();

      expect(Array.isArray(tools)).toBe(true);
      expect(Array.isArray(prompts)).toBe(true);
    });

    it("should throw error for unknown tool", async () => {
      await expect(mcpService.runTool("unknown-tool", {})).rejects.toThrow(
        "Tool unknown-tool not found"
      );
    });
  });

  describe("shutdown", () => {
    it("should handle shutdown gracefully", async () => {
      await mcpService.initialize(mockAssistant);
      await expect(mcpService.shutdown()).resolves.not.toThrow();

      const state = mcpService.getState();
      expect(state.isReady).toBe(false);
      expect(state.mcpService).toBeNull();
    });

    it("should handle multiple shutdown calls", async () => {
      await mcpService.initialize(mockAssistant);
      await mcpService.shutdown();
      await expect(mcpService.shutdown()).resolves.not.toThrow();
    });
  });
});
