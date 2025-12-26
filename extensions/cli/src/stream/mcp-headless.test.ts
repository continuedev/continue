import { describe, expect, test, beforeEach } from "vitest";

import {
  initializeServices,
  serviceContainer,
  SERVICE_NAMES,
} from "../services/index.js";
import type { MCPServiceState } from "../services/types.js";
import type { PreprocessedToolCall, Tool } from "../tools/types.js";

import { getRequestTools } from "./handleToolCalls.js";
import { checkToolPermissionApproval } from "./streamChatResponse.helpers.js";

describe("MCP tools in headless mode", () => {
  beforeEach(() => {
    // Clean up service container state before each test
    Object.values(SERVICE_NAMES).forEach((service) => {
      (serviceContainer as any).services.delete(service);
      (serviceContainer as any).factories.delete(service);
      (serviceContainer as any).dependencies.delete(service);
    });
  });

  test("should exclude MCP tools by default in headless mode", async () => {
    await initializeServices({ headless: true });

    // Mock MCP state with a server that doesn't have allowHeadless
    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "test-server",
            command: "npx",
            args: ["test"],
            // allowHeadless: undefined (default)
          },
          status: "connected",
          tools: [
            {
              name: "mcp__test__search",
              description: "Search tool",
              inputSchema: {
                type: "object",
                properties: {},
              },
            },
          ],
          prompts: [],
          warnings: [],
        },
      ],
      tools: [],
      prompts: [],
    };

    // Inject mock state
    const mcpService = await serviceContainer.get(SERVICE_NAMES.MCP);
    (mcpService as any).connections = mockMcpState.connections;

    const tools = await getRequestTools(true); // headless = true
    const toolNames = tools.map((t) => t.function.name);

    // MCP tool should NOT be in the list (default behavior)
    expect(toolNames).not.toContain("mcp__test__search");

    // Built-in tools should still be available
    expect(toolNames).toContain("Read");
    expect(toolNames).toContain("List");
  });

  test("should include MCP tools when allowHeadless=true in headless mode", async () => {
    await initializeServices({ headless: true });

    // Mock MCP state with a server that HAS allowHeadless: true
    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "test-server",
            command: "npx",
            args: ["test"],
            allowHeadless: true, // ← Explicitly allow in headless
          },
          status: "connected",
          tools: [
            {
              name: "mcp__test__search",
              description: "Search tool",
              inputSchema: {
                type: "object",
                properties: {},
              },
            },
          ],
          prompts: [],
          warnings: [],
        },
      ],
      tools: [],
      prompts: [],
    };

    // Inject mock state
    const mcpService = await serviceContainer.get(SERVICE_NAMES.MCP);
    (mcpService as any).connections = mockMcpState.connections;

    const tools = await getRequestTools(true); // headless = true
    const toolNames = tools.map((t) => t.function.name);

    // MCP tool SHOULD be in the list (allowHeadless: true)
    expect(toolNames).toContain("mcp__test__search");

    // Built-in tools should still be available
    expect(toolNames).toContain("Read");
    expect(toolNames).toContain("List");
  });

  test("should include all MCP tools in interactive mode regardless of allowHeadless", async () => {
    await initializeServices({ headless: false });

    // Mock MCP state with allowHeadless: false
    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "test-server",
            command: "npx",
            args: ["test"],
            allowHeadless: false, // Explicitly disallow headless
          },
          status: "connected",
          tools: [
            {
              name: "mcp__test__search",
              description: "Search tool",
              inputSchema: {
                type: "object",
                properties: {},
              },
            },
          ],
          prompts: [],
          warnings: [],
        },
      ],
      tools: [],
      prompts: [],
    };

    // Inject mock state
    const mcpService = await serviceContainer.get(SERVICE_NAMES.MCP);
    (mcpService as any).connections = mockMcpState.connections;

    const tools = await getRequestTools(false); // headless = false (interactive)
    const toolNames = tools.map((t) => t.function.name);

    // MCP tool SHOULD be available in interactive mode even with allowHeadless: false
    expect(toolNames).toContain("mcp__test__search");
  });

  test("should handle multiple MCP servers with different allowHeadless settings", async () => {
    await initializeServices({ headless: true });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "safe-server",
            command: "npx",
            args: ["safe"],
            allowHeadless: true, // Allowed in headless
          },
          status: "connected",
          tools: [
            {
              name: "mcp__safe__read",
              description: "Safe read tool",
              inputSchema: { type: "object", properties: {} },
            },
          ],
          prompts: [],
          warnings: [],
        },
        {
          config: {
            name: "restricted-server",
            command: "npx",
            args: ["restricted"],
            allowHeadless: false, // Not allowed in headless
          },
          status: "connected",
          tools: [
            {
              name: "mcp__restricted__write",
              description: "Restricted write tool",
              inputSchema: { type: "object", properties: {} },
            },
          ],
          prompts: [],
          warnings: [],
        },
      ],
      tools: [],
      prompts: [],
    };

    const mcpService = await serviceContainer.get(SERVICE_NAMES.MCP);
    (mcpService as any).connections = mockMcpState.connections;

    const tools = await getRequestTools(true); // headless = true
    const toolNames = tools.map((t) => t.function.name);

    // Safe server tool should be available
    expect(toolNames).toContain("mcp__safe__read");

    // Restricted server tool should NOT be available
    expect(toolNames).not.toContain("mcp__restricted__write");
  });
});

describe("MCP tool execution permission in headless mode", () => {
  // Helper to create a mock PreprocessedToolCall
  function createMockToolCall(
    toolName: string,
    allowHeadless?: boolean,
  ): PreprocessedToolCall {
    const tool: Tool = {
      name: toolName,
      displayName: toolName,
      description: "Test tool",
      parameters: { type: "object", properties: {} },
      run: async () => "result",
      isBuiltIn: false,
      // Preserve undefined to properly test undefined vs explicit false
      ...(allowHeadless !== undefined && { allowHeadless }),
    };
    return {
      id: "test-id",
      name: toolName,
      arguments: {},
      argumentsStr: "{}",
      startNotified: false,
      tool,
    };
  }

  test("should approve MCP tool with allowHeadless=true in headless mode", async () => {
    const toolCall = createMockToolCall("mcp__test__search", true);
    // Empty policies array - no explicit allow/deny, so default is "ask"
    const permissions = { policies: [] };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined, // no callbacks
      true, // isHeadless
    );

    expect(result.approved).toBe(true);
  });

  test("should deny MCP tool without allowHeadless in headless mode", async () => {
    const toolCall = createMockToolCall("mcp__test__search", false);
    const permissions = { policies: [] };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined, // no callbacks
      true, // isHeadless
    );

    expect(result.approved).toBe(false);
    expect(result.denialReason).toBe("policy");
  });

  test("should deny MCP tool with allowHeadless=undefined in headless mode", async () => {
    const toolCall = createMockToolCall("mcp__test__search", undefined);
    const permissions = { policies: [] };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined, // no callbacks
      true, // isHeadless
    );

    expect(result.approved).toBe(false);
    expect(result.denialReason).toBe("policy");
  });

  test("should approve explicitly allowed tools regardless of allowHeadless", async () => {
    const toolCall = createMockToolCall("mcp__test__search", false);
    // Explicit allow policy for this tool
    const permissions = {
      policies: [{ tool: "mcp__test__search", permission: "allow" as const }],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined, // no callbacks
      true, // isHeadless
    );

    expect(result.approved).toBe(true);
  });

  test("should deny explicitly excluded tools even with allowHeadless=true", async () => {
    const toolCall = createMockToolCall("mcp__test__search", true);
    // Explicit exclude policy for this tool - should override allowHeadless
    const permissions = {
      policies: [{ tool: "mcp__test__search", permission: "exclude" as const }],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined, // no callbacks
      true, // isHeadless
    );

    // Explicit exclusion should be respected even with allowHeadless=true
    expect(result.approved).toBe(false);
    expect(result.denialReason).toBe("policy");
  });
});
