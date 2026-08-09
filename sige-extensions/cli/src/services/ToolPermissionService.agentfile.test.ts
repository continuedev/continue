import { ALL_BUILT_IN_TOOLS } from "src/tools/allBuiltIns.js";

import { ToolPermissionService } from "./ToolPermissionService.js";
import { AgentFileServiceState, MCPServiceState } from "./types.js";

describe("ToolPermissionService - Agent File Integration", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  describe("generateAgentFilePolicies - No parsed tools", () => {
    it("should allow all tools when agent file is present but parsedTools is null", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: null, // No parsed tools
        parsedRules: null,
      };

      const policies = service.generateAgentFilePolicies(agentFileState);

      expect(policies).toEqual([
        {
          tool: "*",
          permission: "allow",
        },
      ]);
    });

    it("should allow all tools when agent file is present but parsedTools is undefined", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: undefined as any,
        parsedRules: null,
      };

      const policies = service.generateAgentFilePolicies(agentFileState);

      expect(policies).toEqual([
        {
          tool: "*",
          permission: "allow",
        },
      ]);
    });

    it("should allow all tools when agentFileServiceState is undefined", () => {
      const policies = service.generateAgentFilePolicies(undefined);

      expect(policies).toEqual([
        {
          tool: "*",
          permission: "allow",
        },
      ]);
    });
  });

  describe("generateAgentFilePolicies - With MCP servers", () => {
    it("should allow specific MCP tools when explicitly listed", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/mcp-server"],
          tools: [{ mcpServer: "owner/mcp-server", toolName: "specific_tool" }],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const mcpState: MCPServiceState = {
        mcpService: null,
        connections: [
          {
            config: { sourceSlug: "owner/mcp-server" } as any,
            status: "connected",
            tools: [
              { name: "specific_tool" } as any,
              { name: "other_tool" } as any,
              { name: "another_tool" } as any,
            ],
            prompts: [],
            warnings: [],
          },
        ],
        tools: [],
        prompts: [],
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        mcpState,
      );

      // Should allow the specific tool
      expect(policies).toContainEqual({
        tool: "specific_tool",
        permission: "allow",
      });

      // Should exclude the other tools from the same server
      expect(policies).toContainEqual({
        tool: "other_tool",
        permission: "exclude",
      });
      expect(policies).toContainEqual({
        tool: "another_tool",
        permission: "exclude",
      });

      // Should have wildcard allow at the end
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should allow all tools from MCP server when server is listed without specific tools", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/mcp-server"],
          tools: [
            { mcpServer: "owner/mcp-server" }, // No toolName = all tools from this server
          ],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const mcpState: MCPServiceState = {
        mcpService: null,
        connections: [
          {
            config: { sourceSlug: "owner/mcp-server" } as any,
            status: "connected",
            tools: [
              { name: "tool1" } as any,
              { name: "tool2" } as any,
              { name: "tool3" } as any,
            ],
            prompts: [],
            warnings: [],
          },
        ],
        tools: [],
        prompts: [],
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        mcpState,
      );

      // Since no specific tools were mentioned, MCP logic doesn't explicitly allow/exclude
      // The wildcard allow at the end covers all MCP tools
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should handle multiple MCP servers with mixed specific and blanket access", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/server1", "owner/server2"],
          tools: [
            { mcpServer: "owner/server1", toolName: "specific_tool" },
            { mcpServer: "owner/server2" }, // All tools from server2
          ],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const mcpState: MCPServiceState = {
        mcpService: null,
        connections: [
          {
            config: { sourceSlug: "owner/server1" } as any,
            status: "connected",
            tools: [
              { name: "specific_tool" } as any,
              { name: "other_tool" } as any,
            ],
            prompts: [],
            warnings: [],
          },
          {
            config: { sourceSlug: "owner/server2" } as any,
            status: "connected",
            tools: [{ name: "tool_a" } as any, { name: "tool_b" } as any],
            prompts: [],
            warnings: [],
          },
        ],
        tools: [],
        prompts: [],
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        mcpState,
      );

      // Server1: Should allow specific_tool and exclude other_tool
      expect(policies).toContainEqual({
        tool: "specific_tool",
        permission: "allow",
      });
      expect(policies).toContainEqual({
        tool: "other_tool",
        permission: "exclude",
      });

      // Server2: No specific tools, so wildcard covers them
      // Should have wildcard allow at the end
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should handle MCP server not found in connections", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/missing-server"],
          tools: [
            { mcpServer: "owner/missing-server", toolName: "specific_tool" },
          ],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const mcpState: MCPServiceState = {
        mcpService: null,
        connections: [], // No connections
        tools: [],
        prompts: [],
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        mcpState,
      );

      // Should still have wildcard allow at the end
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });
  });

  describe("generateAgentFilePolicies - With built-in tools", () => {
    it("should allow only specific built-in tools when listed", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: [],
          tools: [{ toolName: "Bash" }, { toolName: "Read" }],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const policies = service.generateAgentFilePolicies(agentFileState);

      // Should allow the specific built-in tools
      expect(policies).toContainEqual({
        tool: "Bash",
        permission: "allow",
      });
      expect(policies).toContainEqual({
        tool: "Read",
        permission: "allow",
      });

      // Should exclude all other built-in tools
      const allBuiltInNames = ALL_BUILT_IN_TOOLS.map((t) => t.name);
      const notListed = allBuiltInNames.filter(
        (name) => name !== "Bash" && name !== "Read",
      );

      for (const toolName of notListed) {
        expect(policies).toContainEqual({
          tool: toolName,
          permission: "exclude",
        });
      }

      // Should have wildcard allow at the end
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should allow all built-in tools when allBuiltIn is true", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: [],
          tools: [],
          allBuiltIn: true,
        },
        parsedRules: null,
      };

      const policies = service.generateAgentFilePolicies(agentFileState);

      // Should NOT have any exclude policies for built-in tools
      const excludePolicies = policies.filter(
        (p) => p.permission === "exclude",
      );
      expect(excludePolicies).toEqual([]);

      // Should have wildcard allow at the end
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should exclude built-in tools when MCP servers are present but allBuiltIn is false", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/mcp-server"],
          tools: [{ mcpServer: "owner/mcp-server" }],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const mcpState: MCPServiceState = {
        mcpService: null,
        connections: [
          {
            config: { sourceSlug: "owner/mcp-server" } as any,
            status: "connected",
            tools: [{ name: "mcp_tool" } as any],
            prompts: [],
            warnings: [],
          },
        ],
        tools: [],
        prompts: [],
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        mcpState,
      );

      // Should exclude all built-in tools
      const allBuiltInNames = ALL_BUILT_IN_TOOLS.map((t) => t.name);
      for (const toolName of allBuiltInNames) {
        expect(policies).toContainEqual({
          tool: toolName,
          permission: "exclude",
        });
      }

      // Should have wildcard allow at the end
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should allow both built-in tools and MCP tools when both are specified", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/mcp-server"],
          tools: [
            { toolName: "Bash" },
            { toolName: "Read" },
            { mcpServer: "owner/mcp-server", toolName: "mcp_tool" },
          ],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const mcpState: MCPServiceState = {
        mcpService: null,
        connections: [
          {
            config: { sourceSlug: "owner/mcp-server" } as any,
            status: "connected",
            tools: [
              { name: "mcp_tool" } as any,
              { name: "other_mcp_tool" } as any,
            ],
            prompts: [],
            warnings: [],
          },
        ],
        tools: [],
        prompts: [],
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        mcpState,
      );

      // Should allow the specific MCP tool
      expect(policies).toContainEqual({
        tool: "mcp_tool",
        permission: "allow",
      });

      // Should exclude the other MCP tool
      expect(policies).toContainEqual({
        tool: "other_mcp_tool",
        permission: "exclude",
      });

      // Should allow the specific built-in tools
      expect(policies).toContainEqual({
        tool: "Bash",
        permission: "allow",
      });
      expect(policies).toContainEqual({
        tool: "Read",
        permission: "allow",
      });

      // Should exclude other built-in tools
      const allBuiltInNames = ALL_BUILT_IN_TOOLS.map((t) => t.name);
      const notListed = allBuiltInNames.filter(
        (name) => name !== "Bash" && name !== "Read",
      );

      for (const toolName of notListed) {
        expect(policies).toContainEqual({
          tool: toolName,
          permission: "exclude",
        });
      }

      // Should have wildcard allow at the end
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });
  });

  describe("initializeSync with agent file", () => {
    it("should use agent file policies when agent file is present with no parsed tools", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: null, // No parsed tools
        parsedRules: null,
      };

      const state = service.initializeSync(undefined, agentFileState);

      // Should have wildcard allow policy
      expect(state.permissions.policies).toEqual([
        {
          tool: "*",
          permission: "allow",
        },
      ]);
    });

    it("should use agent file policies when agent file is present with parsed tools", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: [],
          tools: [{ toolName: "Bash" }],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const state = service.initializeSync(undefined, agentFileState);

      // Should have specific policies for Bash and exclusions for others
      expect(state.permissions.policies).toContainEqual({
        tool: "Bash",
        permission: "allow",
      });

      // Should exclude other built-in tools
      const allBuiltInNames = ALL_BUILT_IN_TOOLS.map((t) => t.name);
      const notBash = allBuiltInNames.filter((name) => name !== "Bash");

      for (const toolName of notBash) {
        expect(state.permissions.policies).toContainEqual({
          tool: toolName,
          permission: "exclude",
        });
      }

      // Should have wildcard allow at the end
      const lastPolicy =
        state.permissions.policies[state.permissions.policies.length - 1];
      expect(lastPolicy).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should use normal resolution when agent file is not present", () => {
      const state = service.initializeSync(undefined, undefined);

      // Should have normal policies (not just wildcard allow)
      expect(state.permissions.policies.length).toBeGreaterThan(1);
      // Should not be just wildcard allow
      expect(state.permissions.policies).not.toEqual([
        {
          tool: "*",
          permission: "allow",
        },
      ]);
    });

    it("should prioritize agent file over runtime overrides", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: [],
          tools: [{ toolName: "Read" }],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const runtimeOverrides = {
        allow: ["Bash", "Write"],
        exclude: ["Read"],
      };

      const state = service.initializeSync(
        runtimeOverrides,
        agentFileState,
        undefined,
      );

      // Agent file should take precedence, so Read should be allowed (not excluded)
      expect(state.permissions.policies).toContainEqual({
        tool: "Read",
        permission: "allow",
      });

      // Bash should be excluded (not in agent file)
      expect(state.permissions.policies).toContainEqual({
        tool: "Bash",
        permission: "exclude",
      });
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should handle empty parsed tools arrays - allows everything", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: [],
          tools: [],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const policies = service.generateAgentFilePolicies(agentFileState);

      // With empty tools array and no MCP servers, the logic doesn't enter
      // the exclusion path, so it just returns wildcard allow
      // This is the "blank = all built-in tools" case from the comments
      expect(policies).toEqual([
        {
          tool: "*",
          permission: "allow",
        },
      ]);
    });

    it("should handle MCP state with empty connections array", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/mcp-server"],
          tools: [{ mcpServer: "owner/mcp-server", toolName: "specific_tool" }],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const mcpState: MCPServiceState = {
        mcpService: null,
        connections: [],
        tools: [],
        prompts: [],
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        mcpState,
      );

      // Should still generate policies and have wildcard allow
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should handle MCP state being undefined", () => {
      const agentFileState: AgentFileServiceState = {
        agentFile: { name: "test-agent" } as any,
        slug: "test-slug",
        agentFileModel: null,
        parsedTools: {
          mcpServers: ["owner/mcp-server"],
          tools: [{ mcpServer: "owner/mcp-server", toolName: "specific_tool" }],
          allBuiltIn: false,
        },
        parsedRules: null,
      };

      const policies = service.generateAgentFilePolicies(
        agentFileState,
        undefined,
      );

      // Should still generate policies and have wildcard allow
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });
  });
});
