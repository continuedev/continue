import { DEFAULT_TOOL_POLICIES } from "../permissions/defaultPolicies.js";
import { ToolPermissionPolicy } from "../permissions/types.js";
import { ToolPermissionService } from "./ToolPermissionService.js";

describe("ToolPermissionService", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  describe("initialization", () => {
    it("should initialize with default policies when no overrides provided", async () => {
      const state = await service.initialize();
      
      expect(state.permissions.policies).toEqual(DEFAULT_TOOL_POLICIES);
      expect(state.permissions.policies.length).toBe(DEFAULT_TOOL_POLICIES.length);
    });

    it("should prepend runtime overrides to default policies", async () => {
      const overrides = {
        allow: ["TestTool1"],
        ask: ["TestTool2"],
        exclude: ["TestTool3"]
      };

      const state = await service.initialize(overrides);
      const policies = state.permissions.policies;

      // Check that overrides are at the beginning
      expect(policies[0]).toEqual({ tool: "TestTool1", permission: "allow" });
      expect(policies[1]).toEqual({ tool: "TestTool2", permission: "ask" });
      expect(policies[2]).toEqual({ tool: "TestTool3", permission: "exclude" });

      // Check that defaults follow
      expect(policies.slice(3)).toEqual(DEFAULT_TOOL_POLICIES);
    });

    it("should handle empty override arrays", async () => {
      const overrides = {
        allow: [],
        ask: [],
        exclude: []
      };

      const state = await service.initialize(overrides);
      
      expect(state.permissions.policies).toEqual(DEFAULT_TOOL_POLICIES);
    });

    it("should handle partial overrides", async () => {
      const overrides = {
        allow: ["OnlyAllowTool"]
        // ask and exclude are undefined
      };

      const state = await service.initialize(overrides);
      const policies = state.permissions.policies;

      expect(policies[0]).toEqual({ tool: "OnlyAllowTool", permission: "allow" });
      expect(policies.slice(1)).toEqual(DEFAULT_TOOL_POLICIES);
    });

    it("should handle multiple tools in same override category", async () => {
      const overrides = {
        exclude: ["Tool1", "Tool2", "Tool3"]
      };

      const state = await service.initialize(overrides);
      const policies = state.permissions.policies;

      expect(policies[0]).toEqual({ tool: "Tool1", permission: "exclude" });
      expect(policies[1]).toEqual({ tool: "Tool2", permission: "exclude" });
      expect(policies[2]).toEqual({ tool: "Tool3", permission: "exclude" });
    });
  });

  describe("getState", () => {
    it("should return current state after initialization", async () => {
      await service.initialize();
      const state = service.getState();

      expect(state).toBeDefined();
      expect(state.permissions).toBeDefined();
      expect(state.permissions.policies).toEqual(DEFAULT_TOOL_POLICIES);
    });

    it("should return state with overrides", async () => {
      const overrides = {
        allow: ["TestTool"]
      };

      await service.initialize(overrides);
      const state = service.getState();

      expect(state.permissions.policies[0]).toEqual({ tool: "TestTool", permission: "allow" });
    });
  });

  describe("getPermissions", () => {
    it("should return permissions object", async () => {
      await service.initialize();
      const permissions = service.getPermissions();

      expect(permissions).toBeDefined();
      expect(permissions.policies).toEqual(DEFAULT_TOOL_POLICIES);
    });
  });

  describe("updatePermissions", () => {
    it("should replace all policies with new ones", async () => {
      await service.initialize();
      
      const newPolicies: ToolPermissionPolicy[] = [
        { tool: "NewTool1", permission: "allow" },
        { tool: "NewTool2", permission: "ask" }
      ];

      service.updatePermissions(newPolicies);
      const state = service.getState();

      expect(state.permissions.policies).toEqual(newPolicies);
      expect(state.permissions.policies.length).toBe(2);
    });

    it("should handle empty policy updates", () => {
      service.updatePermissions([]);
      const state = service.getState();

      expect(state.permissions.policies).toEqual([]);
    });
  });

  describe("override precedence", () => {
    it("should give precedence to runtime overrides over defaults", async () => {
      // Assuming read_file has a default policy
      const overrides = {
        exclude: ["read_file"]
      };

      const state = await service.initialize(overrides);
      const policies = state.permissions.policies;

      // The exclude override should come first
      const readFileOverride = policies.find(p => p.tool === "read_file");
      expect(readFileOverride).toBeDefined();
      expect(readFileOverride?.permission).toBe("exclude");

      // Find the index of the override vs any default
      const overrideIndex = policies.findIndex(p => p.tool === "read_file" && p.permission === "exclude");
      const defaultIndex = policies.findIndex(p => p.tool === "read_file" && p.permission !== "exclude");

      if (defaultIndex !== -1) {
        expect(overrideIndex).toBeLessThan(defaultIndex);
      }
    });
  });

  describe("wildcard support", () => {
    it("should support wildcard patterns in overrides", async () => {
      const overrides = {
        allow: ["mcp__*"],
        exclude: ["write_*"]
      };

      const state = await service.initialize(overrides);
      const policies = state.permissions.policies;

      expect(policies[0]).toEqual({ tool: "mcp__*", permission: "allow" });
      expect(policies[1]).toEqual({ tool: "write_*", permission: "exclude" });
    });
  });
});