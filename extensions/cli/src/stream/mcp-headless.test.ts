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
      // Preserve undefined to test actual undefined behavior
      ...(allowHeadless !== undefined ? { allowHeadless } : {}),
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
    // Explicit exclude policy for this tool
    const permissions = {
      policies: [{ tool: "mcp__test__search", permission: "exclude" as const }],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined, // no callbacks
      true, // isHeadless
    );

    // allowHeadless should NOT bypass explicit exclusions
    expect(result.approved).toBe(false);
    expect(result.denialReason).toBe("policy");
  });

  test("should approve built-in tools in headless mode regardless of allowHeadless", async () => {
    const builtInTool: Tool = {
      name: "Read",
      displayName: "Read",
      description: "Read a file",
      parameters: { type: "object", properties: {} },
      run: async () => "result",
      isBuiltIn: true,
      allowHeadless: false, // Should not affect built-in tools
    };
    const toolCall: PreprocessedToolCall = {
      id: "test-id",
      name: "Read",
      arguments: {},
      argumentsStr: "{}",
      startNotified: false,
      tool: builtInTool,
    };
    const permissions = { policies: [] };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined,
      true, // isHeadless
    );

    // Built-in tools should be approved in headless mode
    expect(result.approved).toBe(true);
  });
});

describe("MCP tool edge cases and error handling", () => {
  beforeEach(() => {
    // Clean up service container state before each test
    Object.values(SERVICE_NAMES).forEach((service) => {
      (serviceContainer as any).services.delete(service);
      (serviceContainer as any).factories.delete(service);
      (serviceContainer as any).dependencies.delete(service);
    });
  });

  test("should handle disconnected MCP servers gracefully", async () => {
    await initializeServices({ headless: true });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "disconnected-server",
            command: "npx",
            args: ["test"],
            allowHeadless: true,
          },
          status: "disconnected", // Server is disconnected
          tools: [
            {
              name: "mcp__test__tool",
              description: "Test tool",
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

    const tools = await getRequestTools(true);
    const toolNames = tools.map((t) => t.function.name);

    // Should still enumerate tools from disconnected server
    // (enumeration happens at config time, not runtime)
    expect(toolNames).toContain("mcp__test__tool");
  });

  test("should handle empty connections array", async () => {
    await initializeServices({ headless: true });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [], // No connections
      tools: [],
      prompts: [],
    };

    const mcpService = await serviceContainer.get(SERVICE_NAMES.MCP);
    (mcpService as any).connections = mockMcpState.connections;

    const tools = await getRequestTools(true);

    // Should not throw, just return built-in tools
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((t) => t.function.name.startsWith("mcp__") === false));
  });

  test("should handle MCP server with empty tools array", async () => {
    await initializeServices({ headless: true });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "empty-server",
            command: "npx",
            args: ["test"],
            allowHeadless: true,
          },
          status: "connected",
          tools: [], // No tools available
          prompts: [],
          warnings: [],
        },
      ],
      tools: [],
      prompts: [],
    };

    const mcpService = await serviceContainer.get(SERVICE_NAMES.MCP);
    (mcpService as any).connections = mockMcpState.connections;

    const tools = await getRequestTools(true);

    // Should not throw, just skip this server
    expect(tools).toBeDefined();
  });

  test("should exclude MCP tools when allowHeadless is explicitly false", async () => {
    await initializeServices({ headless: true });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "test-server",
            command: "npx",
            args: ["test"],
            allowHeadless: false, // Explicitly set to false
          },
          status: "connected",
          tools: [
            {
              name: "mcp__test__search",
              description: "Search tool",
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

    const tools = await getRequestTools(true);
    const toolNames = tools.map((t) => t.function.name);

    // Should be excluded when explicitly false
    expect(toolNames).not.toContain("mcp__test__search");
  });
});

describe("MCP tool permission policy interactions", () => {
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
      ...(allowHeadless !== undefined ? { allowHeadless } : {}),
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

  test("should respect wildcard exclude policies over allowHeadless", async () => {
    const toolCall = createMockToolCall("mcp__test__search", true);
    // Wildcard exclude for all MCP tools
    const permissions = {
      policies: [{ tool: "mcp__*", permission: "exclude" as const }],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined,
      true,
    );

    // Wildcard exclude should take precedence
    expect(result.approved).toBe(false);
    expect(result.denialReason).toBe("policy");
  });

  test("should allow specific tool even with wildcard ask policy", async () => {
    const toolCall = createMockToolCall("mcp__test__search", true);
    // More specific allow should take precedence over wildcard ask
    const permissions = {
      policies: [
        { tool: "mcp__test__search", permission: "allow" as const },
        { tool: "mcp__*", permission: "ask" as const },
      ],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined,
      true,
    );

    // Specific allow should take precedence
    expect(result.approved).toBe(true);
  });

  test("should apply allowHeadless with wildcard ask policy", async () => {
    const toolCall = createMockToolCall("mcp__test__search", true);
    // Wildcard ask for all MCP tools
    const permissions = {
      policies: [{ tool: "mcp__*", permission: "ask" as const }],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined,
      true, // headless
    );

    // allowHeadless should upgrade "ask" to "allow" in headless mode
    expect(result.approved).toBe(true);
  });

  test("should deny wildcard ask without allowHeadless in headless mode", async () => {
    const toolCall = createMockToolCall("mcp__test__search", false);
    // Wildcard ask for all MCP tools
    const permissions = {
      policies: [{ tool: "mcp__*", permission: "ask" as const }],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined,
      true, // headless
    );

    // Without allowHeadless, "ask" should be denied in headless
    expect(result.approved).toBe(false);
    expect(result.denialReason).toBe("policy");
  });

  test("should handle argumentMatches with allowHeadless", async () => {
    const toolCall = createMockToolCall("mcp__test__search", true);
    toolCall.arguments = { query: "safe search" };

    // Policy that matches specific arguments
    const permissions = {
      policies: [
        {
          tool: "mcp__test__search",
          permission: "allow" as const,
          argumentMatches: { query: "safe search" },
        },
      ],
    };

    const result = await checkToolPermissionApproval(
      permissions,
      toolCall,
      undefined,
      true,
    );

    // Should be allowed because arguments match
    expect(result.approved).toBe(true);
  });
});

describe("MCP tool integration tests", () => {
  beforeEach(() => {
    Object.values(SERVICE_NAMES).forEach((service) => {
      (serviceContainer as any).services.delete(service);
      (serviceContainer as any).factories.delete(service);
      (serviceContainer as any).dependencies.delete(service);
    });
  });

  test("should correctly mix built-in and MCP tools in headless mode", async () => {
    await initializeServices({ headless: true });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "allowed-server",
            command: "npx",
            args: ["test"],
            allowHeadless: true,
          },
          status: "connected",
          tools: [
            {
              name: "mcp__allowed__search",
              description: "Allowed search",
              inputSchema: { type: "object", properties: {} },
            },
          ],
          prompts: [],
          warnings: [],
        },
        {
          config: {
            name: "blocked-server",
            command: "npx",
            args: ["test"],
            allowHeadless: false,
          },
          status: "connected",
          tools: [
            {
              name: "mcp__blocked__write",
              description: "Blocked write",
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

    const tools = await getRequestTools(true);
    const toolNames = tools.map((t) => t.function.name);

    // Should have built-in tools
    expect(toolNames).toContain("Read");
    expect(toolNames).toContain("Write");
    expect(toolNames).toContain("List");

    // Should have allowed MCP tool
    expect(toolNames).toContain("mcp__allowed__search");

    // Should NOT have blocked MCP tool
    expect(toolNames).not.toContain("mcp__blocked__write");
  });

  test("should preserve tool order when filtering by allowHeadless", async () => {
    await initializeServices({ headless: true });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "server1",
            command: "npx",
            args: ["test"],
            allowHeadless: true,
          },
          status: "connected",
          tools: [
            {
              name: "mcp__server1__tool_a",
              description: "Tool A",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "mcp__server1__tool_b",
              description: "Tool B",
              inputSchema: { type: "object", properties: {} },
            },
          ],
          prompts: [],
          warnings: [],
        },
        {
          config: {
            name: "server2",
            command: "npx",
            args: ["test"],
            allowHeadless: false,
          },
          status: "connected",
          tools: [
            {
              name: "mcp__server2__tool_c",
              description: "Tool C",
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

    const tools = await getRequestTools(true);
    const mcpTools = tools.filter((t) => t.function.name.startsWith("mcp__"));
    const mcpToolNames = mcpTools.map((t) => t.function.name);

    // Should maintain relative order of allowed tools
    expect(mcpToolNames).toEqual([
      "mcp__server1__tool_a",
      "mcp__server1__tool_b",
    ]);
  });

  test("should handle transition from interactive to headless mode", async () => {
    // Start in interactive mode
    await initializeServices({ headless: false });

    const mockMcpState: MCPServiceState = {
      mcpService: null,
      connections: [
        {
          config: {
            name: "test-server",
            command: "npx",
            args: ["test"],
            allowHeadless: false,
          },
          status: "connected",
          tools: [
            {
              name: "mcp__test__tool",
              description: "Test tool",
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

    // In interactive mode, tool should be available
    const interactiveTools = await getRequestTools(false);
    const interactiveToolNames = interactiveTools.map((t) => t.function.name);
    expect(interactiveToolNames).toContain("mcp__test__tool");

    // In headless mode, same tool should be excluded
    const headlessTools = await getRequestTools(true);
    const headlessToolNames = headlessTools.map((t) => t.function.name);
    expect(headlessToolNames).not.toContain("mcp__test__tool");
  });
});
