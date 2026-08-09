import { getDefaultToolPolicies } from "../permissions/defaultPolicies.js";

import { ToolPermissionService } from "./ToolPermissionService.js";

const DEFAULT_TOOL_POLICIES = getDefaultToolPolicies();

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
      exclude: ["forbidden_tool", "write_*"],
    };

    const state = await service.initialize(overrides);

    // Verify the compiled policies
    const policies = state.permissions.policies;

    // Find the runtime override policies (they should be at the beginning)
    const excludePolicy1 = policies.find(
      (p) => p.tool === "forbidden_tool" && p.permission === "exclude",
    );
    const excludePolicy2 = policies.find(
      (p) => p.tool === "write_*" && p.permission === "exclude",
    );
    const askPolicy = policies.find(
      (p) => p.tool === "sensitive_tool" && p.permission === "ask",
    );
    const allowPolicy = policies.find(
      (p) => p.tool === "dangerous_tool" && p.permission === "allow",
    );

    // Verify runtime overrides are present
    expect(excludePolicy1).toBeDefined();
    expect(excludePolicy2).toBeDefined();
    expect(askPolicy).toBeDefined();
    expect(allowPolicy).toBeDefined();

    // Verify all default policies are present
    for (const defaultPolicy of DEFAULT_TOOL_POLICIES) {
      const foundPolicy = policies.find(
        (p) =>
          p.tool === defaultPolicy.tool &&
          p.permission === defaultPolicy.permission,
      );
      expect(foundPolicy).toBeDefined();
    }
  });

  it("should allow dynamic updates after initialization", async () => {
    // Start with defaults (may include additional policies from permissions.yaml)
    await service.initialize();

    let permissions = service.getPermissions();

    // Verify all default policies are present (may have additional ones)
    for (const defaultPolicy of DEFAULT_TOOL_POLICIES) {
      const foundPolicy = permissions.policies.find(
        (p) =>
          p.tool === defaultPolicy.tool &&
          p.permission === defaultPolicy.permission,
      );
      expect(foundPolicy).toBeDefined();
    }

    // Update with new policies (this replaces ALL policies)
    const newPolicies = [
      { tool: "*", permission: "ask" as const }, // Ask for everything
    ];

    service.updatePermissions(newPolicies);

    permissions = service.getPermissions();
    expect(permissions.policies).toEqual(newPolicies);
    expect(permissions.policies.length).toBe(1);
  });

  it("should maintain state consistency", async () => {
    const overrides = {
      exclude: ["test_tool"],
    };

    await service.initialize(overrides);

    // Both getState and getPermissions should return same data
    const state = service.getState();
    const permissions = service.getPermissions();

    // getState() returns a shallow copy, so nested objects are the same reference
    expect(state.permissions).toEqual(permissions);
    expect(state.permissions).toBe(permissions); // Same reference for nested objects
    expect(state.permissions.policies[0]).toEqual({
      tool: "test_tool",
      permission: "exclude",
    });
  });

  it("should handle concurrent access correctly", async () => {
    // Initialize service
    await service.initialize({ allow: ["tool1"] });

    // Simulate concurrent reads
    const promises = Array(10)
      .fill(null)
      .map(() => Promise.resolve(service.getPermissions()));

    const results = await Promise.all(promises);

    // All should return the same value
    const firstResult = results[0];
    results.forEach((result) => {
      expect(result).toStrictEqual(firstResult);
    });
  });
});
