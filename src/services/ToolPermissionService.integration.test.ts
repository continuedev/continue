import { jest } from "@jest/globals";
import { DEFAULT_TOOL_POLICIES } from "../permissions/defaultPolicies.js";
import { ToolPermissionService } from "./ToolPermissionService.js";

describe("ToolPermissionService E2E", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  it("should handle complete flow from initialization to usage", async () => {
    // Initialize with overrides
    const overrides = {
      allow: ["dangerous_tool"],
      ask: ["sensitive_tool"],
      exclude: ["forbidden_tool", "write_*"]
    };

    const state = await service.initialize(overrides);

    // Verify the compiled policies
    const policies = state.permissions.policies;
    
    // Runtime overrides should be first, in order: exclude, ask, allow
    expect(policies[0]).toEqual({ tool: "forbidden_tool", permission: "exclude" });
    expect(policies[1]).toEqual({ tool: "write_*", permission: "exclude" });
    expect(policies[2]).toEqual({ tool: "sensitive_tool", permission: "ask" });
    expect(policies[3]).toEqual({ tool: "dangerous_tool", permission: "allow" });
    
    // Defaults should follow
    expect(policies.slice(4)).toEqual(DEFAULT_TOOL_POLICIES);
  });

  it("should allow dynamic updates after initialization", async () => {
    // Start with defaults
    await service.initialize();
    
    let permissions = service.getPermissions();
    expect(permissions.policies).toEqual(DEFAULT_TOOL_POLICIES);

    // Update with new policies
    const newPolicies = [
      { tool: "*", permission: "ask" as const }  // Ask for everything
    ];
    
    service.updatePermissions(newPolicies);
    
    permissions = service.getPermissions();
    expect(permissions.policies).toEqual(newPolicies);
    expect(permissions.policies.length).toBe(1);
  });

  it("should maintain state consistency", async () => {
    const overrides = {
      exclude: ["test_tool"]
    };

    await service.initialize(overrides);
    
    // Both getState and getPermissions should return same data
    const state = service.getState();
    const permissions = service.getPermissions();
    
    expect(state.permissions).toBe(permissions);
    expect(state.permissions.policies[0]).toEqual({ tool: "test_tool", permission: "exclude" });
  });

  it("should handle concurrent access correctly", async () => {
    // Initialize service
    await service.initialize({ allow: ["tool1"] });

    // Simulate concurrent reads
    const promises = Array(10).fill(null).map(() => 
      Promise.resolve(service.getPermissions())
    );

    const results = await Promise.all(promises);
    
    // All should return the same reference
    const firstResult = results[0];
    results.forEach(result => {
      expect(result).toBe(firstResult);
    });
  });
});