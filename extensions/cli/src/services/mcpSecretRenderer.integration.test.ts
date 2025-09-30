import { SseMcpServer, StdioMcpServer } from "@continuedev/config-yaml";
import { type AssistantConfig } from "@continuedev/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MCPService } from "./MCPService.js";

describe("MCPService Secret Rendering Integration", () => {
  let mcpService: MCPService;
  const originalEnv = process.env;

  beforeEach(() => {
    mcpService = new MCPService();
    // Reset process.env
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    await mcpService.cleanup();
    process.env = originalEnv;
  });

  it("should render secrets from environment in STDIO server", async () => {
    process.env.TEST_API_KEY = "test-secret-key";
    process.env.TEST_SECRET_PATH = "/path/to/secret";

    const assistantConfig: AssistantConfig = {
      name: "test-assistant",
      version: "1.0.0",
      mcpServers: [
        {
          name: "test-stdio-server",
          command: "node",
          args: ["server.js", "--token", "${{ secrets.TEST_API_KEY }}"],
          env: {
            SECRET_FILE: "${{ secrets.TEST_SECRET_PATH }}",
            NODE_ENV: "production",
          },
        } as StdioMcpServer,
      ],
    };

    // Mock the client connection to avoid actually connecting
    const originalGetConnectedClient = mcpService["getConnectedClient"];
    mcpService["getConnectedClient"] = async () => {
      throw new Error("Connection failed (expected for test)");
    };

    await mcpService.doInitialize(assistantConfig, true);
    const state = mcpService.getState();

    // Check that the server config was rendered with secrets
    expect(state.connections).toHaveLength(1);
    const connection = state.connections[0];

    expect(connection.config.name).toBe("test-stdio-server");

    if ("command" in connection.config) {
      const stdioConfig = connection.config as StdioMcpServer;
      expect(stdioConfig.command).toBe("node");
      expect(stdioConfig.args).toEqual([
        "server.js",
        "--token",
        "test-secret-key",
      ]);
      expect(stdioConfig.env).toEqual({
        SECRET_FILE: "/path/to/secret",
        NODE_ENV: "production",
      });
    } else {
      throw new Error("Expected STDIO config");
    }

    // Should have no warnings for unrendered secrets
    expect(connection.warnings).toHaveLength(0);
  });

  it("should render secrets from environment in SSE server", async () => {
    process.env.AUTH_TOKEN = "bearer-token-123";

    const assistantConfig: AssistantConfig = {
      name: "test-assistant",
      version: "1.0.0",
      mcpServers: [
        {
          name: "test-sse-server",
          url: "https://api.example.com/mcp",
          type: "sse",
          requestOptions: {
            headers: {
              Authorization: "Bearer ${{ secrets.AUTH_TOKEN }}",
              "User-Agent": "continue-cli",
            },
          },
        } as SseMcpServer,
      ],
    };

    // Mock the client connection to avoid actually connecting
    mcpService["getConnectedClient"] = async () => {
      throw new Error("Connection failed (expected for test)");
    };

    await mcpService.doInitialize(assistantConfig, true);
    const state = mcpService.getState();

    // Check that the server config was rendered with secrets
    expect(state.connections).toHaveLength(1);
    const connection = state.connections[0];

    expect(connection.config.name).toBe("test-sse-server");

    if ("url" in connection.config) {
      const sseConfig = connection.config as SseMcpServer;
      expect(sseConfig.url).toBe("https://api.example.com/mcp");
      expect(sseConfig.requestOptions?.headers).toEqual({
        Authorization: "Bearer bearer-token-123",
        "User-Agent": "continue-cli",
      });
    } else {
      throw new Error("Expected SSE config");
    }

    // Should have no warnings for unrendered secrets
    expect(connection.warnings).toHaveLength(0);
  });

  it("should warn about unrendered secrets when environment variables are missing", async () => {
    // Don't set the environment variable

    const assistantConfig: AssistantConfig = {
      name: "test-assistant",
      version: "1.0.0",
      mcpServers: [
        {
          name: "test-missing-secret",
          command: "node",
          args: ["server.js", "--token", "${{ secrets.MISSING_SECRET }}"],
        } as StdioMcpServer,
      ],
    };

    // Mock the client connection to avoid actually connecting
    mcpService["getConnectedClient"] = async () => {
      throw new Error("Connection failed (expected for test)");
    };

    await mcpService.doInitialize(assistantConfig, true);
    const state = mcpService.getState();

    // Check that the server has warnings about unrendered secrets
    expect(state.connections).toHaveLength(1);
    const connection = state.connections[0];

    expect(connection.warnings).toHaveLength(1);
    expect(connection.warnings[0]).toContain(
      "Unrendered secrets found: MISSING_SECRET",
    );

    // The original template should be preserved
    if ("command" in connection.config) {
      const stdioConfig = connection.config as StdioMcpServer;
      expect(stdioConfig.args).toEqual([
        "server.js",
        "--token",
        "${{ secrets.MISSING_SECRET }}",
      ]);
    } else {
      throw new Error("Expected STDIO config");
    }
  });

  it("should handle mixed rendered and unrendered secrets", async () => {
    process.env.FOUND_SECRET = "found-value";
    // Don't set MISSING_SECRET

    const assistantConfig: AssistantConfig = {
      name: "test-assistant",
      version: "1.0.0",
      mcpServers: [
        {
          name: "test-mixed-secrets",
          command: "node",
          args: [
            "server.js",
            "--found",
            "${{ secrets.FOUND_SECRET }}",
            "--missing",
            "${{ secrets.MISSING_SECRET }}",
          ],
        } as StdioMcpServer,
      ],
    };

    // Mock the client connection to avoid actually connecting
    mcpService["getConnectedClient"] = async () => {
      throw new Error("Connection failed (expected for test)");
    };

    await mcpService.doInitialize(assistantConfig, true);
    const state = mcpService.getState();

    // Check mixed rendering
    expect(state.connections).toHaveLength(1);
    const connection = state.connections[0];

    expect(connection.warnings).toHaveLength(1);
    expect(connection.warnings[0]).toContain(
      "Unrendered secrets found: MISSING_SECRET",
    );

    if ("command" in connection.config) {
      const stdioConfig = connection.config as StdioMcpServer;
      expect(stdioConfig.args).toEqual([
        "server.js",
        "--found",
        "found-value",
        "--missing",
        "${{ secrets.MISSING_SECRET }}",
      ]);
    } else {
      throw new Error("Expected STDIO config");
    }
  });
});
