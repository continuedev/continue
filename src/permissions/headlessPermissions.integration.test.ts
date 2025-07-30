import { resolvePermissionPrecedence } from "./precedenceResolver.js";
import { HEADLESS_TOOL_POLICIES, DEFAULT_TOOL_POLICIES } from "./defaultPolicies.js";
import { checkToolPermission } from "./permissionChecker.js";

describe("Headless Permissions Integration", () => {
  describe("precedence resolution with headless mode", () => {
    it("should use headless policies when headless: true", () => {
      const policies = resolvePermissionPrecedence({
        useDefaults: true,
        personalSettings: false, // Disable to avoid file system dependencies
        headless: true,
      });

      expect(policies).toEqual(HEADLESS_TOOL_POLICIES);
      expect(policies.length).toBe(1);
      expect(policies[0]).toEqual({ tool: "*", permission: "allow" });
    });

    it("should use normal policies when headless: false", () => {
      const policies = resolvePermissionPrecedence({
        useDefaults: true,
        personalSettings: false,
        headless: false,
      });

      expect(policies).toEqual(DEFAULT_TOOL_POLICIES);
      expect(policies.length).toBeGreaterThan(1);
      
      // Check that write operations require confirmation in normal mode
      const writePolicy = policies.find(p => p.tool === "write_file");
      expect(writePolicy?.permission).toBe("ask");
    });

    it("should allow CLI overrides to supersede headless defaults", () => {
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
      // Headless wildcard should still be present
      expect(policies[1]).toEqual({ tool: "*", permission: "allow" });
    });
  });

  describe("permission checking with headless policies", () => {
    it("should allow all tools with headless policies", () => {
      const permissions = { policies: HEADLESS_TOOL_POLICIES };

      // Test various tool types
      const toolsToTest = [
        "write_file",
        "run_terminal_command", 
        "read_file",
        "search_code",
        "some_unknown_tool",
        "mcp__custom_tool"
      ];

      for (const toolName of toolsToTest) {
        const result = checkToolPermission(
          { name: toolName, arguments: {} },
          permissions
        );
        
        expect(result.permission).toBe("allow");
        expect(result.matchedPolicy).toEqual({ tool: "*", permission: "allow" });
      }
    });

    it("should respect CLI overrides even in headless mode", () => {
      const policies = [
        { tool: "dangerous_tool", permission: "exclude" as const },
        { tool: "*", permission: "allow" as const },
      ];
      const permissions = { policies };

      // Excluded tool should be blocked
      const excludedResult = checkToolPermission(
        { name: "dangerous_tool", arguments: {} },
        permissions
      );
      expect(excludedResult.permission).toBe("exclude");

      // Other tools should be allowed
      const allowedResult = checkToolPermission(
        { name: "safe_tool", arguments: {} },
        permissions
      );
      expect(allowedResult.permission).toBe("allow");
    });
  });

  describe("real-world headless scenarios", () => {
    it("should handle typical CLI workflow in headless mode", () => {
      // Simulate headless mode with some CLI overrides
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          // Still exclude truly dangerous operations
          exclude: ["rm", "sudo"],
          // Allow specific tools that might normally require confirmation
          allow: ["git", "npm"],
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
      expect(checkToolPermission({ name: "git", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "npm", arguments: {} }, permissions).permission).toBe("allow");

      // Other tools should fall back to headless wildcard (allow)
      expect(checkToolPermission({ name: "write_file", arguments: {} }, permissions).permission).toBe("allow");
      expect(checkToolPermission({ name: "unknown_tool", arguments: {} }, permissions).permission).toBe("allow");
    });
  });
});