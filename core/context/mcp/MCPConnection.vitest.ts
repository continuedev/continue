import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

    it("should fall back to homedir for remote URIs that cannot be used as local cwd", async () => {
      const ide = {} as any;
      vi.spyOn(ideUtils, "resolveRelativePathInDir").mockResolvedValue(
        "vscode-remote://ssh-remote+192.168.137.2/home/user/project",
      );
      const conn = new MCPConnection(baseOptions, { ide });

      const { homedir } = require("os");
      await expect((conn as any).resolveCwd("src")).resolves.toBe(homedir());
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

  describe("resource template discovery (stdio SDK server)", () => {
    const fixture = path.join(__dirname, "fixtures", "stdioResourceServer.mjs");
    const connections: MCPConnection[] = [];
    let tmpDir: string;

    const fixtureOptions = (
      id: string,
      flags: string[] = [],
      timeout?: number,
    ): InternalStdioMcpOptions => ({
      id,
      name: id,
      type: "stdio",
      command: process.execPath,
      args: [fixture, ...flags],
      timeout,
    });

    const connect = async (options: InternalStdioMcpOptions) => {
      const conn = new MCPConnection(options);
      connections.push(conn);
      await conn.connectClient(true, new AbortController().signal);
      return conn;
    };

    const toolNames = (conn: MCPConnection) => conn.tools.map((t) => t.name);

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-templates-"));
    });

    afterEach(async () => {
      await Promise.all(
        connections.splice(0).map((conn) => conn.disconnect().catch(() => {})),
      );
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("keeps a server usable when it does not serve resources/templates/list", async () => {
      const conn = await connect(fixtureOptions("no-templates"));

      expect(conn.status).toBe("connected");
      expect(conn.errors).toEqual([]);
      expect(conn.resources.map((r) => r.uri)).toEqual([
        "synthetic://alpha",
        "synthetic://beta",
      ]);
      expect(conn.resourceTemplates).toEqual([]);
      expect(toolNames(conn)).toEqual(["echo_types", "stats"]);
      expect(conn.tools[0].inputSchema).toEqual({
        type: "object",
        properties: { text: { type: "string" }, count: { type: "integer" } },
      });

      const result = await conn.client.callTool({
        name: "stats",
        arguments: {},
      });
      expect(result.content).toEqual([{ type: "text", text: "items: 2" }]);
    });

    it("preserves resources and valid resource templates", async () => {
      const conn = await connect(
        fixtureOptions("valid-templates", ["--templates=valid"]),
      );

      expect(conn.status).toBe("connected");
      expect(conn.errors).toEqual([]);
      expect(conn.resources).toHaveLength(2);
      expect(conn.resourceTemplates).toEqual([
        { uriTemplate: "synthetic://item/{id}", name: "Item" },
      ]);
    });

    it("reports internal errors from template listing", async () => {
      const conn = await connect(
        fixtureOptions("internal-error", ["--templates=internal-error"]),
      );

      expect(conn.status).toBe("connected");
      expect(conn.errors).toHaveLength(1);
      expect(conn.errors[0]).toMatch(
        /^Error loading resource templates for MCP Server internal-error: MCP error -32603: .*synthetic failure$/,
      );
      expect(conn.resources).toHaveLength(2);
      expect(toolNames(conn)).toEqual(["echo_types", "stats"]);
    });

    it("reports malformed template listings", async () => {
      const conn = await connect(
        fixtureOptions("malformed", ["--templates=malformed"]),
      );

      expect(conn.errors).toHaveLength(1);
      expect(conn.errors[0]).toMatch(
        /^Error loading resource templates for MCP Server malformed: /,
      );
      expect(conn.resourceTemplates).toEqual([]);
      expect(conn.resources).toHaveLength(2);
      expect(toolNames(conn)).toEqual(["echo_types", "stats"]);
    });

    it("does not ignore a template listing that times out", async () => {
      const conn = await connect(
        fixtureOptions("hang", ["--templates=hang"], 1500),
      );

      // Status is not asserted: discovery still in flight when the connection
      // timeout fires can overwrite "error" with "connected" (pre-existing)
      expect(conn.errors).toContainEqual(
        expect.stringContaining("Connection timed out"),
      );
      expect(conn.errors).toContainEqual(
        expect.stringMatching(
          /^Error loading resource templates for MCP Server hang: MCP error -32001: /,
        ),
      );
      expect(conn.resourceTemplates).toEqual([]);
    });

    it("reports tool discovery failures and keeps resources", async () => {
      const conn = await connect(
        fixtureOptions("tools-error", ["--tools=internal-error"]),
      );

      expect(conn.status).toBe("connected");
      expect(conn.errors).toHaveLength(1);
      expect(conn.errors[0]).toMatch(
        /^Error loading tools for MCP Server tools-error: MCP error -32603: .*synthetic tools failure$/,
      );
      expect(conn.tools).toEqual([]);
      expect(conn.resources).toHaveLength(2);
    });

    it("fails the connection when the server exits during initialization", async () => {
      const marker = path.join(tmpDir, "crashed");
      const conn = await connect(
        fixtureOptions("crash", [`--crash-once=${marker}`]),
      );

      expect(conn.status).toBe("error");
      expect(conn.errors).toHaveLength(1);
      expect(conn.errors[0]).toMatch(/^Failed to connect to "crash"/);
      expect(conn.tools).toEqual([]);
    });

    it("reconnects after a failed connection without stale errors or duplicate tools", async () => {
      const marker = path.join(tmpDir, "crashed");
      const conn = await connect(
        fixtureOptions("reconnect", [`--crash-once=${marker}`]),
      );
      expect(conn.status).toBe("error");

      await conn.connectClient(true, new AbortController().signal);

      expect(conn.status).toBe("connected");
      expect(conn.errors).toEqual([]);
      expect(toolNames(conn)).toEqual(["echo_types", "stats"]);
      expect(conn.resources).toHaveLength(2);
    });

    it("keeps discovery state independent across servers", async () => {
      const [unsupported, failing] = await Promise.all([
        connect(fixtureOptions("server-a")),
        connect(fixtureOptions("server-b", ["--templates=internal-error"])),
      ]);

      expect(unsupported.errors).toEqual([]);
      expect(failing.errors).toHaveLength(1);
      expect(failing.errors[0]).toMatch(
        /^Error loading resource templates for MCP Server server-b: MCP error -32603: /,
      );
      expect(unsupported.tools).not.toBe(failing.tools);
      expect(toolNames(unsupported)).toEqual(["echo_types", "stats"]);
      expect(toolNames(failing)).toEqual(["echo_types", "stats"]);
    });
  });

  describe("resource template discovery errors", () => {
    const options: InternalStdioMcpOptions = {
      name: "test-mcp",
      id: "test-id",
      type: "stdio",
      command: "test-cmd",
      args: [],
    };

    const mockServer = (capabilities: Record<string, object>) => {
      vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined);
      vi.spyOn(Client.prototype, "getServerCapabilities").mockReturnValue(
        capabilities,
      );
      vi.spyOn(Client.prototype, "listResources").mockResolvedValue({
        resources: [{ name: "test-resource", uri: "test-uri" }],
      });
      vi.spyOn(Client.prototype, "listTools").mockResolvedValue({
        tools: [{ name: "test-tool", inputSchema: { type: "object" } }],
      });
    };

    it("treats a structured MethodNotFound error as unsupported", async () => {
      mockServer({ resources: {}, tools: {} });
      vi.spyOn(Client.prototype, "listResourceTemplates").mockRejectedValue(
        new McpError(ErrorCode.MethodNotFound, "Method not found"),
      );

      const conn = new MCPConnection(options);
      await conn.connectClient(false, new AbortController().signal);

      expect(conn.status).toBe("connected");
      expect(conn.errors).toEqual([]);
      expect(conn.resources).toHaveLength(1);
      expect(conn.tools).toHaveLength(1);
    });

    it.each([
      [
        "an unstructured error with the same text",
        new Error("MCP error -32601: Method not found"),
      ],
      [
        "invalid params",
        new McpError(ErrorCode.InvalidParams, "Invalid params"),
      ],
      [
        "a request timeout",
        new McpError(ErrorCode.RequestTimeout, "Request timed out"),
      ],
      [
        "a closed connection",
        new McpError(ErrorCode.ConnectionClosed, "Connection closed"),
      ],
    ])("still reports %s", async (_, error) => {
      mockServer({ resources: {}, tools: {} });
      vi.spyOn(Client.prototype, "listResourceTemplates").mockRejectedValue(
        error,
      );

      const conn = new MCPConnection(options);
      await conn.connectClient(false, new AbortController().signal);

      expect(conn.errors).toEqual([
        `Error loading resource templates for MCP Server test-mcp: ${error.message}`,
      ]);
      expect(conn.tools).toHaveLength(1);
    });

    it("still reports MethodNotFound from resources/list", async () => {
      mockServer({ resources: {}, tools: {} });
      vi.spyOn(Client.prototype, "listResources").mockRejectedValue(
        new McpError(ErrorCode.MethodNotFound, "Method not found"),
      );
      vi.spyOn(Client.prototype, "listResourceTemplates").mockResolvedValue({
        resourceTemplates: [],
      });

      const conn = new MCPConnection(options);
      await conn.connectClient(false, new AbortController().signal);

      expect(conn.errors).toEqual([
        "Error loading resources for MCP Server test-mcp: MCP error -32601: Method not found",
      ]);
    });

    it("does not request templates from a tools-only server", async () => {
      mockServer({ tools: {} });
      const listResourceTemplates = vi.spyOn(
        Client.prototype,
        "listResourceTemplates",
      );

      const conn = new MCPConnection(options);
      await conn.connectClient(false, new AbortController().signal);

      expect(listResourceTemplates).not.toHaveBeenCalled();
      expect(conn.errors).toEqual([]);
      expect(conn.tools).toHaveLength(1);
    });
  });

  describe("resolveCommandForPlatform", () => {
    const baseOptions: InternalStdioMcpOptions = {
      name: "test-mcp",
      id: "test-id",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    };

    it("should NOT wrap with cmd.exe when Windows host connects to WSL remote", async () => {
      const mockIde = {
        getIdeInfo: vi.fn().mockResolvedValue({ remoteName: "wsl" }),
      } as any;

      const conn = new MCPConnection(baseOptions, { ide: mockIde });

      // Mock process.platform to be win32
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      try {
        const result = await (conn as any).resolveCommandForPlatform("npx", [
          "-y",
          "test",
        ]);
        // Should NOT wrap with cmd.exe when in WSL
        expect(result.command).toBe("npx");
        expect(result.args).toEqual(["-y", "test"]);
      } finally {
        Object.defineProperty(process, "platform", { value: originalPlatform });
      }
    });

    it("should wrap with cmd.exe when Windows host is local (not WSL)", async () => {
      const mockIde = {
        getIdeInfo: vi.fn().mockResolvedValue({ remoteName: "" }),
      } as any;

      const conn = new MCPConnection(baseOptions, { ide: mockIde });

      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      try {
        const result = await (conn as any).resolveCommandForPlatform("npx", [
          "-y",
          "test",
        ]);
        // Should wrap with cmd.exe for local Windows
        expect(result.command).toBe("cmd.exe");
        expect(result.args).toEqual(["/c", "npx", "-y", "test"]);
      } finally {
        Object.defineProperty(process, "platform", { value: originalPlatform });
      }
    });

    it("should NOT wrap with cmd.exe on Linux regardless of batch command", async () => {
      const conn = new MCPConnection(baseOptions);

      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      try {
        const result = await (conn as any).resolveCommandForPlatform("npx", [
          "-y",
          "test",
        ]);
        expect(result.command).toBe("npx");
        expect(result.args).toEqual(["-y", "test"]);
      } finally {
        Object.defineProperty(process, "platform", { value: originalPlatform });
      }
    });

    it("should NOT wrap non-batch commands even on Windows", async () => {
      const mockIde = {
        getIdeInfo: vi.fn().mockResolvedValue({ remoteName: "" }),
      } as any;

      const conn = new MCPConnection(baseOptions, { ide: mockIde });

      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      try {
        const result = await (conn as any).resolveCommandForPlatform("python", [
          "script.py",
        ]);
        // python is not in WINDOWS_BATCH_COMMANDS, so no wrapping
        expect(result.command).toBe("python");
        expect(result.args).toEqual(["script.py"]);
      } finally {
        Object.defineProperty(process, "platform", { value: originalPlatform });
      }
    });
  });
});
