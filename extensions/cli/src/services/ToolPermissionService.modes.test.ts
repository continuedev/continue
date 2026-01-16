import { beforeEach, describe, expect, it } from "vitest";

import { ToolPermissionService } from "./ToolPermissionService.js";

describe("ToolPermissionService - Mode Functionality", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  describe("mode initialization", () => {
    it("should initialize with normal mode by default", () => {
      const state = service.initializeSync();
      expect(state.currentMode).toBe("normal");
    });

    it("should initialize with specified mode", () => {
      const state = service.initializeSync({ mode: "plan" });
      expect(state.currentMode).toBe("plan");
    });

    it("should generate correct policies for plan mode", () => {
      const state = service.initializeSync({ mode: "plan" });
      const policies = state.permissions.policies;

      // Should have specific policies for write tools (excluded)
      expect(
        policies.some((p) => p.tool === "Write" && p.permission === "exclude"),
      ).toBe(true);
      expect(
        policies.some((p) => p.tool === "Edit" && p.permission === "exclude"),
      ).toBe(true);
      expect(
        policies.some((p) => p.tool === "Bash" && p.permission === "allow"),
      ).toBe(true);

      // Should have specific policies for read tools (allowed)
      expect(
        policies.some((p) => p.tool === "Read" && p.permission === "allow"),
      ).toBe(true);
      expect(
        policies.some((p) => p.tool === "Search" && p.permission === "allow"),
      ).toBe(true);
      expect(
        policies.some((p) => p.tool === "List" && p.permission === "allow"),
      ).toBe(true);

      // Plan mode allows all other tools (including MCP) with wildcard
      expect(
        policies.some((p) => p.tool === "*" && p.permission === "allow"),
      ).toBe(true);
    });

    it("should generate correct policies for auto mode", () => {
      const state = service.initializeSync({ mode: "auto" });
      const policies = state.permissions.policies;

      // First policy should be the mode policy (allow all)
      expect(policies[0]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    it("should have mode-specific policy positioning", () => {
      const normalState = service.initializeSync({ mode: "normal" });
      const planState = service.initializeSync({ mode: "plan" });

      // Normal mode may have default policies but no mode-specific wildcard at the start
      const normalFirstPolicy = normalState.permissions.policies[0];
      expect(
        normalFirstPolicy?.tool !== "*" ||
          normalFirstPolicy?.permission !== "exclude",
      ).toBe(true);

      // Plan mode should have write exclusions and read allowances
      const planPolicies = planState.permissions.policies;
      expect(
        planPolicies.some(
          (p) => p.tool === "Write" && p.permission === "exclude",
        ),
      ).toBe(true);
      expect(
        planPolicies.some((p) => p.tool === "Read" && p.permission === "allow"),
      ).toBe(true);
    });
  });

  describe("mode switching", () => {
    beforeEach(() => {
      service.initializeSync();
    });

    it("should switch from normal to plan mode", () => {
      expect(service.getCurrentMode()).toBe("normal");

      const newState = service.switchMode("plan");

      expect(newState.currentMode).toBe("plan");
      expect(service.getCurrentMode()).toBe("plan");
    });

    it("should update policies when switching modes", () => {
      service.initializeSync({ mode: "normal" });
      const normalPolicies = service.getPermissions().policies;

      service.switchMode("plan");
      const planPolicies = service.getPermissions().policies;

      expect(planPolicies).not.toEqual(normalPolicies);
      expect(
        planPolicies.some(
          (p) => p.tool === "Write" && p.permission === "exclude",
        ),
      ).toBe(true);
    });

    it("should use absolute override for plan mode (ignore non-mode policies)", () => {
      // Initialize with some existing policies
      service.initializeSync({
        allow: ["allowedTool"],
        exclude: ["excludedTool"],
      });

      const initialPolicies = service.getPermissions().policies;
      const nonModePolicyCount = initialPolicies.length;

      service.switchMode("plan");
      const newPolicies = service.getPermissions().policies;

      // Plan mode should use ONLY mode policies (absolute override)
      // Should contain Write exclude policy for plan mode
      const writePolicy = newPolicies.find((p) => p.tool === "Write");
      expect(writePolicy?.permission).toBe("exclude");

      // Should not contain any user-defined policies from the initial setup
      const userAllowPolicy = newPolicies.find((p) => p.tool === "allowedTool");
      const userExcludePolicy = newPolicies.find(
        (p) => p.tool === "excludedTool",
      );
      expect(userAllowPolicy).toBeUndefined();
      expect(userExcludePolicy).toBeUndefined();
    });

    it("should handle switching between different modes", () => {
      service.switchMode("plan");
      expect(service.getCurrentMode()).toBe("plan");

      service.switchMode("auto");
      expect(service.getCurrentMode()).toBe("auto");

      service.switchMode("normal");
      expect(service.getCurrentMode()).toBe("normal");
    });

    it("should preserve original user policies when switching modes", () => {
      // Initialize with user-defined policies
      service.initializeSync({
        allow: ["customAllowedTool"],
        exclude: ["customExcludedTool"],
        ask: ["customAskTool"],
      });

      const originalPolicies = service.getPermissions().policies;
      const userPolicyCount = originalPolicies.filter(
        (p) =>
          p.tool === "customAllowedTool" ||
          p.tool === "customExcludedTool" ||
          p.tool === "customAskTool",
      ).length;
      expect(userPolicyCount).toBe(3);

      // Switch to plan mode (should store original policies)
      service.switchMode("plan");
      const planPolicies = service.getPermissions().policies;

      // Plan mode should not have user policies
      const planUserPolicyCount = planPolicies.filter(
        (p) =>
          p.tool === "customAllowedTool" ||
          p.tool === "customExcludedTool" ||
          p.tool === "customAskTool",
      ).length;
      expect(planUserPolicyCount).toBe(0);

      // Switch back to normal mode (should restore original policies)
      service.switchMode("normal");
      const restoredPolicies = service.getPermissions().policies;

      // Should have user policies restored
      const restoredUserPolicyCount = restoredPolicies.filter(
        (p) =>
          p.tool === "customAllowedTool" ||
          p.tool === "customExcludedTool" ||
          p.tool === "customAskTool",
      ).length;
      expect(restoredUserPolicyCount).toBe(3);

      // Verify specific policies are restored correctly
      expect(
        restoredPolicies.some(
          (p) => p.tool === "customAllowedTool" && p.permission === "allow",
        ),
      ).toBe(true);
      expect(
        restoredPolicies.some(
          (p) => p.tool === "customExcludedTool" && p.permission === "exclude",
        ),
      ).toBe(true);
      expect(
        restoredPolicies.some(
          (p) => p.tool === "customAskTool" && p.permission === "ask",
        ),
      ).toBe(true);
    });

    it("should override user permissions in plan mode", () => {
      // Initialize with user config that allows write tools
      service.initializeSync({
        allow: ["Write", "Edit", "Bash"],
        mode: "plan",
      });

      const policies = service.getPermissions().policies;

      // Mode policies should override user config - Write should be excluded despite being in allow list
      expect(
        policies.some((p) => p.tool === "Write" && p.permission === "exclude"),
      ).toBe(true);
      expect(
        policies.some((p) => p.tool === "Edit" && p.permission === "exclude"),
      ).toBe(true);
      expect(
        policies.some((p) => p.tool === "Bash" && p.permission === "allow"),
      ).toBe(true);

      // Read tools should be allowed
      expect(
        policies.some((p) => p.tool === "Read" && p.permission === "allow"),
      ).toBe(true);
    });

    it("should override user permissions in auto mode", () => {
      // Initialize with user config that excludes tools
      service.initializeSync({
        exclude: ["Write", "Edit", "Bash"],
        mode: "auto",
      });

      const policies = service.getPermissions().policies;

      // Mode policies should override user config - everything should be allowed
      expect(policies[0]).toEqual({ tool: "*", permission: "allow" });
    });
  });

  describe("mode policy generation", () => {
    it("should generate policies in correct order (mode policies first)", () => {
      const state = service.initializeSync({
        mode: "plan",
        allow: ["customTool"],
      });
      const policies = state.permissions.policies;

      // Mode policies should come first, and there should be policies
      expect(policies.length).toBeGreaterThan(0);

      // Plan mode has wildcard allow policy for MCP and other tools
      expect(
        policies.some((p) => p.tool === "*" && p.permission === "allow"),
      ).toBe(true);
    });
  });

  describe("getCurrentMode", () => {
    it("should return the current mode", () => {
      service.initializeSync({ mode: "plan" });
      expect(service.getCurrentMode()).toBe("plan");

      service.switchMode("auto");
      expect(service.getCurrentMode()).toBe("auto");
    });
  });

  describe("state consistency", () => {
    it("should maintain consistent state between getState and getCurrentMode", () => {
      service.initializeSync({ mode: "plan" });

      const state = service.getState();
      const currentMode = service.getCurrentMode();

      expect(state.currentMode).toBe(currentMode);
      expect(currentMode).toBe("plan");
    });

    it("should update state when switching modes", () => {
      service.initializeSync();

      const initialState = service.getState();
      expect(initialState.currentMode).toBe("normal");

      service.switchMode("plan");

      const newState = service.getState();
      expect(newState.currentMode).toBe("plan");
      expect(newState).not.toEqual(initialState);
    });
  });
});
