import { ToolPermissionService } from "./ToolPermissionService.js";

describe("ToolPermissionService unit tests", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  describe("synchronous initialization", () => {
    it("should initialize with runtime overrides", () => {
      const overrides = {
        allow: ["TestTool1"],
        ask: ["TestTool2"],
        exclude: ["TestTool3"],
      };

      const state = service.initializeSync(overrides);

      // Verify the state is set
      expect(state).toBeDefined();
      expect(state.permissions).toBeDefined();
      expect(state.permissions.policies).toBeDefined();
      expect(state.permissions.policies.length).toBeGreaterThan(0);

      // Verify the overrides are in the policies (they should be at the beginning due to precedence)
      const toolNames = state.permissions.policies.map((p) => p.tool);
      expect(toolNames).toContain("TestTool3");
      expect(toolNames).toContain("TestTool2");
      expect(toolNames).toContain("TestTool1");
    });

    it("should handle empty overrides", () => {
      const overrides = {
        allow: [],
        ask: [],
        exclude: [],
      };

      const state = service.initializeSync(overrides);

      expect(state).toBeDefined();
      expect(state.permissions).toBeDefined();
      expect(state.permissions.policies).toBeDefined();
      expect(state.permissions.policies.length).toBeGreaterThan(0);
    });
  });

  describe("getState and getPermissions", () => {
    it("should return consistent state", () => {
      service.initializeSync({ allow: ["TestTool"] });

      const state = service.getState();
      const permissions = service.getPermissions();

      // getState() returns a shallow copy, getPermissions() returns the same permissions object
      expect(state.permissions).toEqual(permissions);
      expect(state.permissions).toBe(permissions); // Same reference with shallow copy

      // Multiple calls to getPermissions() should return the same reference
      const permissions2 = service.getPermissions();
      expect(permissions).toEqual(permissions2);
      expect(permissions).toBe(permissions2); // Same reference
    });
  });

  describe("updatePermissions", () => {
    it("should replace all policies", () => {
      service.initializeSync();

      const newPolicies = [
        { tool: "NewTool1", permission: "allow" as const },
        { tool: "NewTool2", permission: "ask" as const },
      ];

      service.updatePermissions(newPolicies);
      const state = service.getState();

      expect(state.permissions.policies).toEqual(newPolicies);
      expect(state.permissions.policies.length).toBe(2);
    });
  });

  // Headless mode functionality is tested in precedenceResolver.test.ts and integration tests
});
