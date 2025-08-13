import { AssistantConfig } from "@continuedev/sdk";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { MCPService } from "./mcp.js";


// Mock the logger
vi.mock("./util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the MCP SDK
const mockClient = {
  connect: vi.fn(),
  getServerCapabilities: vi.fn(() => ({ prompts: true, tools: true })),
  listPrompts: vi.fn(() => Promise.resolve({ prompts: [] })),
  listTools: vi.fn(() => Promise.resolve({ tools: [] })),
  callTool: vi.fn(() => Promise.resolve({})),
  close: vi.fn(() => Promise.resolve()),
};

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(() => mockClient),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
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
    vi.clearAllMocks();
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
      expect(info).toHaveProperty("toolNames");
      expect(info).toHaveProperty("promptNames");
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
