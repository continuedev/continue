import { jest } from "@jest/globals";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import MCPConnection from "./MCPConnection";

describe("MCPConnection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with stdio transport", () => {
      const options = {
        name: "test-mcp",
        id: "test-id",
        transport: {
          type: "stdio" as const,
          command: "test-cmd",
          args: ["--test"],
          env: { TEST: "true" },
        },
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
    });

    it("should create instance with websocket transport", () => {
      const options = {
        name: "test-mcp",
        id: "test-id",
        transport: {
          type: "websocket" as const,
          url: "ws://test.com",
        },
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
    });

    it("should create instance with SSE transport", () => {
      const options = {
        name: "test-mcp",
        id: "test-id",
        transport: {
          type: "sse" as const,
          url: "http://test.com/events",
        },
      };

      const conn = new MCPConnection(options);
      expect(conn).toBeInstanceOf(MCPConnection);
      expect(conn.status).toBe("not-connected");
    });

    it("should throw on invalid transport type", () => {
      const options = {
        name: "test-mcp",
        id: "test-id",
        transport: {
          type: "invalid",
        } as any,
      };

      expect(() => new MCPConnection(options)).toThrow(
        "Unsupported transport type: invalid",
      );
    });
  });

  describe("getStatus", () => {
    it("should return current status", () => {
      const options = {
        name: "test-mcp",
        id: "test-id",
        transport: {
          type: "stdio" as const,
          command: "test",
          args: [],
        },
      };

      const conn = new MCPConnection(options);
      const status = conn.getStatus();

      expect(status).toEqual({
        ...options,
        errors: [],
        prompts: [],
        resources: [],
        tools: [],
        status: "not-connected",
      });
    });
  });

  describe("connectClient", () => {
    const options = {
      name: "test-mcp",
      id: "test-id",
      transport: {
        type: "stdio" as const,
        command: "test-cmd",
        args: [],
      },
    };

    it("should connect successfully", async () => {
      const conn = new MCPConnection(options);
      const mockConnect = jest
        .spyOn(Client.prototype, "connect")
        .mockResolvedValue(undefined);
      const mockGetServerCapabilities = jest
        .spyOn(Client.prototype, "getServerCapabilities")
        .mockReturnValue({
          resources: {},
          tools: {},
          prompts: {},
        });

      const mockListResources = jest
        .spyOn(Client.prototype, "listResources")
        .mockResolvedValue({
          resources: [{ name: "test-resource", uri: "test-uri" }],
        });
      const mockListTools = jest
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
      const mockListPrompts = jest
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

    it("should handle connection timeout", async () => {
      const conn = new MCPConnection({ ...options, timeout: 1 });
      const mockConnect = jest
        .spyOn(Client.prototype, "connect")
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        );

      const abortController = new AbortController();
      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("error");
      expect(conn.errors[0]).toContain("Failed to connect to MCP server");
      expect(mockConnect).toHaveBeenCalled();
    });

    it("should handle already connected state", async () => {
      const conn = new MCPConnection(options);
      conn.status = "connected";

      const mockConnect = jest.spyOn(Client.prototype, "connect");
      const abortController = new AbortController();

      await conn.connectClient(false, abortController.signal);

      expect(mockConnect).not.toHaveBeenCalled();
      expect(conn.status).toBe("connected");
    });

    it("should handle transport errors", async () => {
      const conn = new MCPConnection(options);
      const mockConnect = jest
        .spyOn(Client.prototype, "connect")
        .mockRejectedValue(new Error("spawn test-cmd ENOENT"));

      const abortController = new AbortController();
      await conn.connectClient(false, abortController.signal);

      expect(conn.status).toBe("error");
      expect(conn.errors[0]).toContain('command "test-cmd" not found');
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe.skip("actually connect to Filesystem MCP", () => {
    it("should connect and include correct tools", async () => {
      const conn = new MCPConnection({
        id: "filesystem",
        name: "Filesystem",
        transport: {
          type: "stdio" as const,
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
        },
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
