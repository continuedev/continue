import { resolvePermissionPrecedence } from "./precedenceResolver.js";
import { DEFAULT_TOOL_POLICIES } from "./defaultPolicies.js";
import { checkToolPermission } from "./permissionChecker.js";

describe("Headless Permissions Integration", () => {
  describe("precedence resolution with headless mode", () => {
    it("should use same default policies for both headless and normal modes", () => {
      const headlessPolicies = resolvePermissionPrecedence({
        useDefaults: true,
        personalSettings: false, // Disable to avoid file system dependencies
        headless: true,
      });

      const normalPolicies = resolvePermissionPrecedence({
        useDefaults: true,
        personalSettings: false,
        headless: false,
      });

      expect(headlessPolicies).toEqual(DEFAULT_TOOL_POLICIES);
      expect(normalPolicies).toEqual(DEFAULT_TOOL_POLICIES);
      expect(headlessPolicies).toEqual(normalPolicies);
    });

    it("should allow CLI overrides to supersede defaults in headless mode", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          exclude: ["dangerous_tool"],
        },
        useDefaults: true,
        personalSettings: false,
        headless: true,
      });

      // CLI exclusion should come first
      expect(policies[0]).toEqual({ tool: "dangerous_tool", permission: "exclude" });
      // Default policies should follow
      expect(policies.slice(1)).toEqual(DEFAULT_TOOL_POLICIES);
    });
  });

  describe("permission checking with default policies", () => {
    it("should follow default permission rules", () => {
      const permissions = { policies: DEFAULT_TOOL_POLICIES };

      // Read-only tools should be allowed
      expect(checkToolPermission({ name: "read_file", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "list_files", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "search_code", arguments: {} }, permissions).permission).toBe("allow");

      // Write operations should require permission  
      expect(checkToolPermission({ name: "write_file", arguments: {} }, permissions).permission).toBe("ask");
      expect(checkToolPermission({ name: "run_terminal_command", arguments: {} }, permissions).permission).toBe("ask");

      // Unknown tools should default to ask
      expect(checkToolPermission({ name: "unknown_tool", arguments: {} }, permissions).permission).toBe("ask");
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
        permissions
      );
      expect(excludedResult.permission).toBe("exclude");

      // Default tools should follow their normal rules
      expect(checkToolPermission({ name: "read_file", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "write_file", arguments: {} }, permissions).permission).toBe("ask");
    });
  });

  describe("real-world headless scenarios", () => {
    it("should handle typical CLI workflow with permission overrides", () => {
      // Simulate headless mode with some CLI overrides
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          // Still exclude truly dangerous operations
          exclude: ["rm", "sudo"],
          // Allow specific tools that would normally require confirmation
          allow: ["write_file", "run_terminal_command"],
        },
        useDefaults: true,
        personalSettings: false,
        headless: true,
      });

      const permissions = { policies };

      // Excluded tools should be blocked
      expect(checkToolPermission({ name: "rm", arguments: {} }, permissions).permission).toBe("exclude");
      expect(checkToolPermission({ name: "sudo", arguments: {} }, permissions).permission).toBe("exclude");

      // Explicitly allowed tools should be allowed
      expect(checkToolPermission({ name: "write_file", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "run_terminal_command", arguments: {} }, permissions).permission).toBe("allow");

      // Read-only tools should still be allowed by default
      expect(checkToolPermission({ name: "read_file", arguments: {} }, permissions).permission).toBe("allow");
      
      // Unknown tools should default to ask (since no wildcard allow override was provided)
      expect(checkToolPermission({ name: "unknown_tool", arguments: {} }, permissions).permission).toBe("ask");
    });

    it("should handle workflow with wildcard allow override", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          allow: ["*"], // Allow all tools
        },
        useDefaults: true,
        personalSettings: false,
        headless: true,
      });

      const permissions = { policies };

      // All tools should be allowed due to wildcard override
      expect(checkToolPermission({ name: "write_file", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "run_terminal_command", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "unknown_tool", arguments: {} }, permissions).permission).toBe("allow");
    });
  });
});