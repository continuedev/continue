import { MCPServer } from "@continuedev/config-yaml";
import { convertYamlMcpToContinueMcp } from "./loadYaml";

describe("MCP Server Configuration Tests", () => {
  test("should convert stdio MCP server correctly", () => {
    const stdioServer: MCPServer = {
      name: "Test Stdio Server",
      type: "stdio",
      command: "uvx",
      args: ["mcp-server-sqlite", "--db-path", "/test.db"],
      env: { TEST_ENV: "value" },
      connectionTimeout: 5000
    };

    const result = convertYamlMcpToContinueMcp(stdioServer);
    
    expect(result).toEqual({
      transport: {
        type: "stdio",
        command: "uvx",
        args: ["mcp-server-sqlite", "--db-path", "/test.db"],
        env: { TEST_ENV: "value" }
      },
      timeout: 5000
    });
  });

  test("should convert SSE MCP server correctly", () => {
    const sseServer: MCPServer = {
      name: "Test SSE Server",
      type: "sse",
      url: "http://localhost:8150/cosmos/mcp/v1/sse",
      connectionTimeout: 3000
    };

    const result = convertYamlMcpToContinueMcp(sseServer);
    
    expect(result).toEqual({
      transport: {
        type: "sse",
        url: "http://localhost:8150/cosmos/mcp/v1/sse"
      },
      timeout: 3000
    });
  });

  test("should convert WebSocket MCP server correctly", () => {
    const wsServer: MCPServer = {
      name: "Test WebSocket Server",
      type: "websocket",
      url: "ws://localhost:8150/cosmos/mcp/v1/ws",
      connectionTimeout: 10000
    };

    const result = convertYamlMcpToContinueMcp(wsServer);
    
    expect(result).toEqual({
      transport: {
        type: "websocket",
        url: "ws://localhost:8150/cosmos/mcp/v1/ws"
      },
      timeout: 10000
    });
  });

  test("should handle legacy MCP server format for backward compatibility", () => {
    // Test with old format that doesn't have a type field
    const legacyServer = {
      name: "Legacy Server",
      command: "old-command",
      args: ["--legacy"],
      connectionTimeout: 2000
    } as any;

    const result = convertYamlMcpToContinueMcp(legacyServer);
    
    expect(result).toEqual({
      transport: {
        type: "stdio",
        command: "old-command",
        args: ["--legacy"],
        env: undefined
      },
      timeout: 2000
    });
  });

  test("should handle missing optional fields", () => {
    const minimalServer: MCPServer = {
      name: "Minimal Server",
      type: "stdio",
      command: "minimal"
    };

    const result = convertYamlMcpToContinueMcp(minimalServer);
    
    expect(result).toEqual({
      transport: {
        type: "stdio",
        command: "minimal",
        args: [],
        env: undefined
      },
      timeout: undefined
    });
  });
});