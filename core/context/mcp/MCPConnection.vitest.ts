import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InternalSseMcpOptions,
  InternalStdioMcpOptions,
  InternalWebsocketMcpOptions,
} from "../..";
import * as ideUtils from "../../util/ideUtils";
import MCPConnection from "./MCPConnection";

// Mock the shell path utility
vi.mock("../../util/shellPath", () => ({
  getEnvPathFromUserShell: vi
    .fn()
    .mockResolvedValue("/usr/local/bin:/usr/bin:/bin"),
}));

describe("MCPConnection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with stdio transport", () => {
      const options: InternalStdioMcpOptions = {
        name: "test-mcp",
        id: "test-id",
        type: "stdio",
        command: "test-cmd",
        args: ["--test"],
        env: { TEST: "true" },
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
    });

    it("should create instance with stdio transport including cwd", () => {
      const options: InternalStdioMcpOptions = {
        name: "test-mcp",
        id: "test-id",
        type: "stdio",
        command: "test-cmd",
        args: ["--test"],
        env: { TEST: "true" },
        cwd: "/path/to/working/directory",
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
      if (conn.options.type === "stdio") {
        expect(conn.options.cwd).toBe("/path/to/working/directory");
      }
    });

    it("should create instance with websocket transport", () => {
      const options: InternalWebsocketMcpOptions = {
        name: "test-mcp",
        id: "test-id",
        type: "websocket",
        url: "ws://test.com",
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
    });

    it("should create instance with SSE transport", () => {
      const options: InternalSseMcpOptions = {
        name: "test-mcp",
        id: "test-id",
        type: "sse",
        url: "http://test.com/events",
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
    });

    it("should create instance with SSE transport and custom headers", () => {
      const options: InternalSseMcpOptions = {
        name: "test-mcp",
        id: "test-id",
        type: "sse",
        url: "http://test.com/events",
        requestOptions: {
          headers: {
            Authorization: "Bearer token123",
            "X-Custom-Header": "custom-value",
          },
        },
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
    });

    it("should throw on invalid transport type", async () => {
      const options = {
        name: "test-mcp",
        id: "test-id",
        type: "invalid" as any,
        url: "",
      };

      const conn = new MCPConnection(options);
      const abortController = new AbortController();

      // The validation now happens during connectClient, not constructor
      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("error");
      expect(conn.errors[0]).toContain("Unsupported transport type: invalid");
    });
  });

  describe("getStatus", () => {
    it("should return current status", () => {
      const options: InternalStdioMcpOptions = {
        name: "test-mcp",
        id: "test-id",
        type: "stdio",
        command: "test",
        args: [],
      };

      const conn = new MCPConnection(options);
      const status = conn.getStatus();

      expect(status).toEqual({
        ...options,
        errors: [],
        infos: [],
        isProtectedResource: false,
        prompts: [],
        resources: [],
        resourceTemplates: [],
        tools: [],
        status: "not-connected",
      });
    });
  });

  describe("resolveCwd", () => {
    const baseOptions = {
      name: "test-mcp",
      id: "test-id",
      type: "stdio" as const,
      command: "test-cmd",
      args: [],
    };

    it("should return absolute cwd unchanged", async () => {
      const conn = new MCPConnection(baseOptions);

      await expect((conn as any).resolveCwd("/tmp/project")).resolves.toBe(
        "/tmp/project",
      );
    });

    it("should resolve relative cwd using IDE workspace", async () => {
      const ide = {} as any;
      const mockResolve = vi
        .spyOn(ideUtils, "resolveRelativePathInDir")
        .mockResolvedValue("file:///workspace/src");
      const conn = new MCPConnection(baseOptions, { ide });

      await expect((conn as any).resolveCwd("src")).resolves.toBe(
        "/workspace/src",
      );
      expect(mockResolve).toHaveBeenCalledWith("src", ide);
    });
  });

  describe("connectClient", () => {
    const options: InternalStdioMcpOptions = {
      name: "test-mcp",
      id: "test-id",
      type: "stdio",
      command: "test-cmd",
      args: [],
    };

    it("should connect successfully", async () => {
      const conn = new MCPConnection(options);
      const mockConnect = vi
        .spyOn(Client.prototype, "connect")
        .mockResolvedValue(undefined);
      const mockGetServerCapabilities = vi
        .spyOn(Client.prototype, "getServerCapabilities")
        .mockReturnValue({
          resources: {},
          tools: {},
          prompts: {},
        });

      const mockListResources = vi
        .spyOn(Client.prototype, "listResources")
        .mockResolvedValue({
          resources: [{ name: "test-resource", uri: "test-uri" }],
        });
      const mockListTools = vi
        .spyOn(Client.prototype, "listTools")
        .mockResolvedValue({
          tools: [
            {
              name: "test-tool",
              inputSchema: {
                type: "object",
              },
            },
          ],
        });
      const mockListPrompts = vi
        .spyOn(Client.prototype, "listPrompts")
        .mockResolvedValue({ prompts: [{ name: "test-prompt" }] });

      const abortController = new AbortController();
      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("connected");
      expect(conn.resources).toHaveLength(1);
      expect(conn.tools).toHaveLength(1);
      expect(conn.prompts).toHaveLength(1);
      expect(mockConnect).toHaveBeenCalled();
    });

    it("should handle custom connection timeout", async () => {
      const conn = new MCPConnection({ ...options, timeout: 1500 });
      const mockConnect = vi
        .spyOn(Client.prototype, "connect")
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 1000)),
        );

      // Mock the required methods for successful connection
      const mockGetServerCapabilities = vi
        .spyOn(Client.prototype, "getServerCapabilities")
        .mockReturnValue({
          resources: {},
          tools: {},
          prompts: {},
        });

      const abortController = new AbortController();
      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("connected");
      expect(mockConnect).toHaveBeenCalled();
    });

    it("should handle connection timeout", async () => {
      const conn = new MCPConnection({ ...options, timeout: 50 });
      const mockConnect = vi
        .spyOn(Client.prototype, "connect")
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        );

      const abortController = new AbortController();
      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("error");
      expect(conn.errors[0]).toContain("Failed to connect");
      // The connection should timeout before connect is called due to transport construction
      // Since transport construction happens first, and we're not mocking that,
      // the timeout will happen during transport construction or connect attempt
    });

    it("should handle already connected state", async () => {
      const conn = new MCPConnection(options);
      conn.status = "connected";

      const mockConnect = vi.spyOn(Client.prototype, "connect");
      const abortController = new AbortController();

      await conn.connectClient(false, abortController.signal);

      expect(mockConnect).not.toHaveBeenCalled();
      expect(conn.status).toBe("connected");
    });

    it("should handle transport errors", async () => {
      const conn = new MCPConnection(options);
      const mockConnect = vi
        .spyOn(Client.prototype, "connect")
        .mockRejectedValue(new Error("spawn test-cmd ENOENT"));

      const abortController = new AbortController();
      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("error");
      expect(conn.errors[0]).toContain('command "test-cmd" not found');
      expect(mockConnect).toHaveBeenCalled();
    });

    it.skip("should include stderr output in error message when stdio command fails", async () => {
      // Clear any existing mocks to ensure we get real behavior
      vi.restoreAllMocks();

      // Use a command that will definitely fail and produce stderr output
      const failingOptions: InternalStdioMcpOptions = {
        name: "failing-mcp",
        id: "failing-id",
        type: "stdio",
        command: "node",
        args: [
          "-e",
          "console.error('Custom error message from stderr'); process.exit(1);",
        ],
        timeout: 5000, // Give enough time for the command to run and fail
      };

      const conn = new MCPConnection(failingOptions);
      const abortController = new AbortController();

      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("error");
      expect(conn.errors).toHaveLength(1);
      expect(conn.errors[0]).toContain("Failed to connect");
      expect(conn.errors[0]).toContain("Process output:");
      expect(conn.errors[0]).toContain("STDERR:");
      expect(conn.errors[0]).toContain("Custom error message from stderr");
    });
  });

  describe.skip("actually connect to Filesystem MCP", () => {
    it("should connect and include correct tools", async () => {
      const conn = new MCPConnection({
        id: "filesystem",
        name: "Filesystem",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      });

      try {
        const abortController = new AbortController();
        await conn.connectClient(false, abortController.signal);
        expect(conn.status).toBe("connected");
      } finally {
        await conn.disconnect();
      }
    });
  });
});
