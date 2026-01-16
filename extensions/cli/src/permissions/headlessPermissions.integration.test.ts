import { getDefaultToolPolicies } from "./defaultPolicies.js";
import { checkToolPermission } from "./permissionChecker.js";
import { resolvePermissionPrecedence } from "./precedenceResolver.js";

const DEFAULT_TOOL_POLICIES = getDefaultToolPolicies();

describe("Headless Permissions Integration", () => {
  describe("precedence resolution", () => {
    it("should use default policies", () => {
      const policies = resolvePermissionPrecedence({
        useDefaults: true,
        personalSettings: false, // Disable to avoid file system dependencies
      });

      expect(policies).toEqual(DEFAULT_TOOL_POLICIES);
    });

    it("should allow CLI overrides to supersede defaults", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          exclude: ["dangerous_tool"],
        },
        useDefaults: true,
        personalSettings: false,
      });

      // CLI exclusion should come first
      expect(policies[0]).toEqual({
        tool: "dangerous_tool",
        permission: "exclude",
      });
      // Default policies should follow
      expect(policies.slice(1)).toEqual(DEFAULT_TOOL_POLICIES);
    });
  });

  describe("permission checking with default policies", () => {
    it("should follow default permission rules", () => {
      const permissions = { policies: DEFAULT_TOOL_POLICIES };

      // Read-only tools should be allowed
      expect(
        checkToolPermission({ name: "Read", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");
      expect(
        checkToolPermission({ name: "List", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");
      expect(
        checkToolPermission({ name: "Search", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");

      // Write operations should require permission
      expect(
        checkToolPermission({ name: "Write", arguments: {} }, permissions)
          .permission,
      ).toBe("ask");
      expect(
        checkToolPermission({ name: "Bash", arguments: {} }, permissions)
          .permission,
      ).toBe("ask");

      // Unknown tools should default to ask
      expect(
        checkToolPermission(
          { name: "unknown_tool", arguments: {} },
          permissions,
        ).permission,
      ).toBe("ask");
    });

    it("should respect CLI overrides even in headless mode", () => {
      const policies = [
        { tool: "dangerous_tool", permission: "exclude" as const },
        ...DEFAULT_TOOL_POLICIES,
      ];
      const permissions = { policies };

      // Excluded tool should be blocked
      const excludedResult = checkToolPermission(
        { name: "dangerous_tool", arguments: {} },
        permissions,
      );
      expect(excludedResult.permission).toBe("exclude");

      // Default tools should follow their normal rules
      expect(
        checkToolPermission({ name: "Read", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");
      expect(
        checkToolPermission({ name: "Write", arguments: {} }, permissions)
          .permission,
      ).toBe("ask");
    });
  });

  describe("real-world headless scenarios", () => {
    it("should handle typical CLI workflow with permission overrides", () => {
      // Simulate CLI with some overrides
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          // Still exclude truly dangerous operations
          exclude: ["rm", "sudo"],
          // Allow specific tools that would normally require confirmation
          allow: ["Write", "Bash"],
        },
        useDefaults: true,
        personalSettings: false,
      });

      const permissions = { policies };

      // Excluded tools should be blocked
      expect(
        checkToolPermission({ name: "rm", arguments: {} }, permissions)
          .permission,
      ).toBe("exclude");
      expect(
        checkToolPermission({ name: "sudo", arguments: {} }, permissions)
          .permission,
      ).toBe("exclude");

      // Explicitly allowed tools should be allowed
      expect(
        checkToolPermission({ name: "Write", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");
      expect(
        checkToolPermission({ name: "Bash", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");

      // Read-only tools should still be allowed by default
      expect(
        checkToolPermission({ name: "Read", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");

      // Unknown tools should default to ask (since no wildcard allow override was provided)
      expect(
        checkToolPermission(
          { name: "unknown_tool", arguments: {} },
          permissions,
        ).permission,
      ).toBe("ask");
    });

    it("should handle workflow with wildcard allow override", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          allow: ["*"], // Allow all tools
        },
        useDefaults: true,
        personalSettings: false,
      });

      const permissions = { policies };

      // All tools should be allowed due to wildcard override
      expect(
        checkToolPermission({ name: "Write", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");
      expect(
        checkToolPermission({ name: "Bash", arguments: {} }, permissions)
          .permission,
      ).toBe("allow");
      expect(
        checkToolPermission(
          { name: "unknown_tool", arguments: {} },
          permissions,
        ).permission,
      ).toBe("allow");
    });
  });
});
