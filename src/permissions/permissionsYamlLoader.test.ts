import { yamlConfigToPolicies } from "./permissionsYamlLoader.js";

describe("permissionsYamlLoader", () => {
  describe("yamlConfigToPolicies", () => {
    it("should convert YAML config to policies with proper order", () => {
      const config = {
        allow: ["Read", "List"],
        ask: ["Write"],
        exclude: ["Bash"],
      };

      const policies = yamlConfigToPolicies(config);

      expect(policies).toEqual([
        { tool: "run_terminal_command", permission: "exclude" },
        { tool: "write_file", permission: "ask" },
        { tool: "read_file", permission: "allow" },
        { tool: "list_files", permission: "allow" },
      ]);
    });

    it("should normalize tool names", () => {
      const config = {
        allow: ["read", "READ", "read_file"],
      };

      const policies = yamlConfigToPolicies(config);

      expect(policies).toEqual([
        { tool: "read_file", permission: "allow" },
        { tool: "read_file", permission: "allow" },
        { tool: "read_file", permission: "allow" },
      ]);
    });

    it("should handle empty config", () => {
      const config = {};

      const policies = yamlConfigToPolicies(config);

      expect(policies).toEqual([]);
    });

    it("should handle wildcard patterns", () => {
      const config = {
        allow: ["mcp__*"],
        exclude: ["*"],
      };

      const policies = yamlConfigToPolicies(config);

      expect(policies).toEqual([
        { tool: "*", permission: "exclude" },
        { tool: "mcp__*", permission: "allow" },
      ]);
    });

    it("should handle missing permission types", () => {
      const config = {
        allow: ["Read"],
        // ask and exclude are undefined
      };

      const policies = yamlConfigToPolicies(config);

      expect(policies).toEqual([{ tool: "read_file", permission: "allow" }]);
    });

    it("should handle all permission types", () => {
      const config = {
        allow: ["Read", "List"],
        ask: ["Write", "Terminal"],
        exclude: ["Fetch", "Exit"],
      };

      const policies = yamlConfigToPolicies(config);

      expect(policies).toEqual([
        { tool: "fetch", permission: "exclude" },
        { tool: "exit", permission: "exclude" },
        { tool: "write_file", permission: "ask" },
        { tool: "run_terminal_command", permission: "ask" },
        { tool: "read_file", permission: "allow" },
        { tool: "list_files", permission: "allow" },
      ]);
    });
  });
});
