import { DEFAULT_TOOL_POLICIES } from "./defaultPolicies.js";
import { resolvePermissionPrecedence } from "./precedenceResolver.js";
import { ToolPermissionPolicy } from "./types.js";

describe("precedenceResolver", () => {
  describe("resolvePermissionPrecedence", () => {
    it("should return default policies when no overrides", () => {
      const policies = resolvePermissionPrecedence({
        useDefaults: true,
        personalSettings: false, // Disable to avoid file system access
      });

      expect(policies).toEqual(DEFAULT_TOOL_POLICIES);
    });

    it("should prioritize command line flags over defaults", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          exclude: ["Read"],
          allow: ["Write"],
        },
        personalSettings: false,
        useDefaults: true,
      });

      // Command line flags should come first
      expect(policies[0]).toEqual({ tool: "Read", permission: "exclude" });
      expect(policies[1]).toEqual({ tool: "Write", permission: "allow" });
    });

    it("should handle wildcard patterns", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          allow: ["mcp__*"],
          exclude: ["*"],
        },
        useDefaults: false,
        personalSettings: false,
      });

      expect(policies).toEqual([
        { tool: "*", permission: "exclude" },
        { tool: "mcp__*", permission: "allow" },
      ]);
    });

    it("should use exact tool names from command line flags", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          allow: ["Read", "write", "BASH"],
        },
        useDefaults: false,
        personalSettings: false,
      });

      expect(policies).toEqual([
        { tool: "Read", permission: "allow" },
        { tool: "write", permission: "allow" },
        { tool: "BASH", permission: "allow" },
      ]);
    });

    it("should handle empty command line flags", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {},
        useDefaults: true,
        personalSettings: false,
      });

      expect(policies).toEqual(DEFAULT_TOOL_POLICIES);
    });

    it("should maintain order within each permission type for CLI flags", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          exclude: ["Write", "Bash"],
          ask: ["List", "Search"],
          allow: ["Read", "Fetch"],
        },
        useDefaults: false,
        personalSettings: false,
      });

      // Order should be: exclude, ask, allow (as specified in the function)
      expect(policies).toEqual([
        { tool: "Write", permission: "exclude" },
        { tool: "Bash", permission: "exclude" },
        { tool: "List", permission: "ask" },
        { tool: "Search", permission: "ask" },
        { tool: "Read", permission: "allow" },
        { tool: "Fetch", permission: "allow" },
      ]);
    });

    it("should apply config permissions with proper precedence", () => {
      const configPolicies: ToolPermissionPolicy[] = [
        { tool: "Write", permission: "allow" },
        { tool: "Read", permission: "ask" },
      ];

      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          exclude: ["Read"], // Should override config
        },
        configPermissions: configPolicies,
        personalSettings: false,
        useDefaults: false,
      });

      // CLI flag should override config
      expect(policies[0]).toEqual({ tool: "Read", permission: "exclude" });
      // Config policy should be present
      expect(policies[1]).toEqual({ tool: "Write", permission: "allow" });
    });

    it("should handle all layers with proper precedence", () => {
      const configPolicies: ToolPermissionPolicy[] = [
        { tool: "Search", permission: "ask" },
      ];

      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          allow: ["Write"],
        },
        configPermissions: configPolicies,
        personalSettings: false,
        useDefaults: true,
      });

      // Find the Write policy - should be from CLI (allow)
      const writePolicy = policies.find((p) => p.tool === "Write");
      expect(writePolicy?.permission).toBe("allow");

      // Find the Search policy - should be from config
      const searchPolicy = policies.find((p) => p.tool === "Search");
      expect(searchPolicy?.permission).toBe("ask");

      // Should still have default policies
      const readPolicy = policies.find((p) => p.tool === "Read");
      expect(readPolicy).toBeDefined();
    });

    describe("precedence rules", () => {
      it("should use default policies when no other sources provided", () => {
        const policies = resolvePermissionPrecedence({
          useDefaults: true,
          personalSettings: false,
        });

        expect(policies).toEqual(DEFAULT_TOOL_POLICIES);
      });

      it("should allow CLI flags to override default policies", () => {
        const policies = resolvePermissionPrecedence({
          commandLineFlags: {
            exclude: ["Write"],
          },
          useDefaults: true,
          personalSettings: false,
        });

        // CLI exclusion should come first
        expect(policies[0]).toEqual({ tool: "Write", permission: "exclude" });
        // Default policies should follow
        expect(policies.slice(1)).toEqual(DEFAULT_TOOL_POLICIES);
      });

      it("should allow config policies to override defaults", () => {
        const configPolicies: ToolPermissionPolicy[] = [
          { tool: "Bash", permission: "allow" },
        ];

        const policies = resolvePermissionPrecedence({
          configPermissions: configPolicies,
          useDefaults: true,
          personalSettings: false,
        });

        // Config policy should override default
        expect(policies[0]).toEqual({ tool: "Bash", permission: "allow" });
        // Default policies should follow
        expect(policies.slice(1)).toEqual(DEFAULT_TOOL_POLICIES);
      });
    });
  });
});
