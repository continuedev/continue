import { AssistantConfig } from "@continuedev/sdk";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { MCPService } from "./mcp.js";

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
          command: "npx",
          args: ["-v"],
          env: { TEST: "value" },
        },
      ],
    } as AssistantConfig;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await mcpService.cleanup()
  });

  describe("initialization", () => {
    it("should initialize with empty state", () => {
      const state = mcpService.getState();
      expect(mcpService.isReady()).toBe(false);
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

      expect(mcpService.isReady()).toBe(true);
      expect(state.connections).toEqual([]);
      expect(state.toolCount).toBe(0);
      expect(state.promptCount).toBe(0);
    });

    it("should initialize and return immediately even with server configs", async () => {
      const state = await mcpService.initialize(mockAssistant);

      // Should return immediately with ready state
      expect(mcpService.isReady()).toBe(true);
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

    it("should get overall status", async () => {
      console.log(mcpService.getConnectionInfo())
      const firstStatus = mcpService.getOverallStatus();
      expect(firstStatus.status).toBe("connected");
      expect(firstStatus.hasWarnings).toBe(false);
      await mcpService.cleanup()
      const secondStatus = mcpService.getOverallStatus();
      expect(secondStatus.status).toBe("idle");
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
      await mcpService.cleanup()

      const state = mcpService.getState();
      expect(state.mcpService?.getState().connections.filter(c => c.status === "connected")).toHaveLength(0)
    });

    it("should handle multiple shutdown calls", async () => {
      await mcpService.initialize(mockAssistant);
      await mcpService.cleanup();
      await expect(mcpService.cleanup()).resolves.not.toThrow();
    });
  });
});
