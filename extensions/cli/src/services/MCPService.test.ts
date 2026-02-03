import { AssistantConfig } from "@continuedev/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MCPService } from "./MCPService.js";

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

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));

describe("MCPService", () => {
  let mcpService: MCPService;
  let mockAssistant: AssistantConfig;

  beforeEach(() => {
    mcpService = new MCPService();
    mockAssistant = {
      name: "Test Config",
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
    await mcpService.cleanup();
  });

  describe("initialization", () => {
    it("should initialize with empty state", () => {
      const state = mcpService.getState();
      expect(mcpService.isReady()).toBe(false);
      expect(state.connections).toEqual([]);
      expect(state.tools.length).toBe(0);
      expect(state.prompts.length).toBe(0);
    });

    it("should initialize with no servers", async () => {
      const emptyAssistant = {
        name: "empty",
        version: "1.0.0",
      } as AssistantConfig;
      const state = await mcpService.initialize(emptyAssistant);

      expect(mcpService.isReady()).toBe(true);
      expect(state.connections).toEqual([]);
      expect(state.tools.length).toBe(0);
      expect(state.prompts.length).toBe(0);
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

    it("should get overall status", async () => {
      const firstStatus = mcpService.getOverallStatus();
      expect(firstStatus.status).toBe("connected");
      expect(firstStatus.hasWarnings).toBe(false);
      await mcpService.cleanup();
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
      await expect(mcpService.shutdownConnections()).resolves.not.toThrow();
    });

    it("should handle server not found error", async () => {
      await expect(mcpService.restartServer("nonexistent")).rejects.toThrow(
        "Server nonexistent not found in configuration",
      );
    });

    it("should handle stop individual server", async () => {
      await expect(mcpService.stopServer("test-server")).resolves.not.toThrow();
    });
  });

  describe("tools and prompts", () => {
    beforeEach(async () => {
      await mcpService.initialize(mockAssistant);
    });

    it("should return empty arrays for tools and prompts initially", () => {
      expect(Array.isArray(mcpService.getState().tools)).toBe(true);
      expect(Array.isArray(mcpService.getState().tools)).toBe(true);
    });

    it("should throw error for unknown tool", async () => {
      await expect(mcpService.runTool("unknown-tool", {})).rejects.toThrow(
        "Tool unknown-tool not found",
      );
    });
  });

  describe("shutdown", () => {
    it("should handle shutdown gracefully", async () => {
      await mcpService.initialize(mockAssistant);
      await mcpService.cleanup();

      const state = mcpService.getState();
      expect(
        state.mcpService
          ?.getState()
          .connections.filter((c) => c.status === "connected"),
      ).toHaveLength(0);
    });

    it("should handle multiple shutdown calls", async () => {
      await mcpService.initialize(mockAssistant);
      await mcpService.cleanup();
      await expect(mcpService.cleanup()).resolves.not.toThrow();
    });
  });

  describe("transport types", () => {
    it("should support SSE transport", async () => {
      const sseAssistant: AssistantConfig = {
        name: "sse-assistant",
        version: "1.0.0",
        mcpServers: [
          {
            name: "sse-server",
            type: "sse",
            url: "https://example.com/sse",
          },
        ],
      } as AssistantConfig;

      await expect(mcpService.initialize(sseAssistant)).resolves.not.toThrow();
    });

    it("should support streamable-http transport", async () => {
      const httpAssistant: AssistantConfig = {
        name: "http-assistant",
        version: "1.0.0",
        mcpServers: [
          {
            name: "http-server",
            type: "streamable-http",
            url: "https://example.com/http",
          },
        ],
      } as AssistantConfig;

      await expect(mcpService.initialize(httpAssistant)).resolves.not.toThrow();
    });

    it("should default to stdio transport when type is not specified", async () => {
      const defaultAssistant: AssistantConfig = {
        name: "Default Config",
        version: "1.0.0",
        mcpServers: [
          {
            name: "default-server",
            command: "npx",
            args: ["-v"],
          },
        ],
      } as AssistantConfig;

      await expect(
        mcpService.initialize(defaultAssistant),
      ).resolves.not.toThrow();
    });
  });
});
