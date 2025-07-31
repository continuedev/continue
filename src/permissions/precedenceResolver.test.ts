import { jest } from "@jest/globals";
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
          exclude: ["read_file"],
          allow: ["write_file"],
        },
        personalSettings: false,
        useDefaults: true,
      });

      // Command line flags should come first
      expect(policies[0]).toEqual({ tool: "read_file", permission: "exclude" });
      expect(policies[1]).toEqual({ tool: "write_file", permission: "allow" });
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

    it("should normalize tool names in command line flags", () => {
      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          allow: ["Read", "write", "BASH"],
        },
        useDefaults: false,
        personalSettings: false,
      });

      expect(policies).toEqual([
        { tool: "read_file", permission: "allow" },
        { tool: "write_file", permission: "allow" },
        { tool: "run_terminal_command", permission: "allow" },
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
        { tool: "write_file", permission: "exclude" },
        { tool: "run_terminal_command", permission: "exclude" },
        { tool: "list_files", permission: "ask" },
        { tool: "search_code", permission: "ask" },
        { tool: "read_file", permission: "allow" },
        { tool: "fetch", permission: "allow" },
      ]);
    });

    it("should apply config permissions with proper precedence", () => {
      const configPolicies: ToolPermissionPolicy[] = [
        { tool: "write_file", permission: "allow" },
        { tool: "read_file", permission: "ask" },
      ];

      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          exclude: ["read_file"], // Should override config
        },
        configPermissions: configPolicies,
        personalSettings: false,
        useDefaults: false,
      });

      // CLI flag should override config
      expect(policies[0]).toEqual({ tool: "read_file", permission: "exclude" });
      // Config policy should be present
      expect(policies[1]).toEqual({ tool: "write_file", permission: "allow" });
    });

    it("should handle all layers with proper precedence", () => {
      const configPolicies: ToolPermissionPolicy[] = [
        { tool: "search_code", permission: "ask" },
      ];

      const policies = resolvePermissionPrecedence({
        commandLineFlags: {
          allow: ["Write"],
        },
        configPermissions: configPolicies,
        personalSettings: false,
        useDefaults: true,
      });

      // Find the write_file policy - should be from CLI (allow)
      const writePolicy = policies.find(p => p.tool === "write_file");
      expect(writePolicy?.permission).toBe("allow");

      // Find the search_code policy - should be from config
      const searchPolicy = policies.find(p => p.tool === "search_code");
      expect(searchPolicy?.permission).toBe("ask");

      // Should still have default policies
      const readPolicy = policies.find(p => p.tool === "read_file");
      expect(readPolicy).toBeDefined();
    });

    describe("headless mode", () => {
      it("should use same policies for headless and normal modes", () => {
        const headlessPolicies = resolvePermissionPrecedence({
          useDefaults: true,
          personalSettings: false,
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

      it("should use default policies when headless is undefined", () => {
        const policies = resolvePermissionPrecedence({
          useDefaults: true,
          personalSettings: false,
        });

        expect(policies).toEqual(DEFAULT_TOOL_POLICIES);
      });

      it("should allow CLI flags to override default policies in headless mode", () => {
        const policies = resolvePermissionPrecedence({
          commandLineFlags: {
            exclude: ["write_file"],
          },
          useDefaults: true,
          personalSettings: false,
          headless: true,
        });

        // CLI exclusion should come first
        expect(policies[0]).toEqual({ tool: "write_file", permission: "exclude" });
        // Default policies should follow
        expect(policies.slice(1)).toEqual(DEFAULT_TOOL_POLICIES);
      });

      it("should allow config policies to override defaults in headless mode", () => {
        const configPolicies: ToolPermissionPolicy[] = [
          { tool: "run_terminal_command", permission: "allow" },
        ];

        const policies = resolvePermissionPrecedence({
          configPermissions: configPolicies,
          useDefaults: true,
          personalSettings: false,
          headless: true,
        });

        // Config policy should override default
        expect(policies[0]).toEqual({ tool: "run_terminal_command", permission: "allow" });
        // Default policies should follow  
        expect(policies.slice(1)).toEqual(DEFAULT_TOOL_POLICIES);
      });
    });
  });
});