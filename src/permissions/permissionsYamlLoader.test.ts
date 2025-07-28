import { yamlConfigToPolicies, parseToolPattern } from "./permissionsYamlLoader.js";

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

  describe("parseToolPattern", () => {
    it("should parse tool name without arguments", () => {
      const policy = parseToolPattern("Write", "allow");
      
      expect(policy).toEqual({
        tool: "write_file",
        permission: "allow"
      });
    });

    it("should parse tool name with file path pattern", () => {
      const policy = parseToolPattern("Write(**/*.ts)", "exclude");
      
      expect(policy).toEqual({
        tool: "write_file",
        permission: "exclude",
        argumentMatches: {
          file_path: "**/*.ts"
        }
      });
    });

    it("should parse bash command with argument", () => {
      const policy = parseToolPattern("Bash(npm install)", "ask");
      
      expect(policy).toEqual({
        tool: "run_terminal_command",
        permission: "ask",
        argumentMatches: {
          command: "npm install"
        }
      });
    });

    it("should handle various tool types with arguments", () => {
      const testCases = [
        {
          pattern: "Read(src/**/*.js)",
          expected: { tool: "read_file", permission: "allow", argumentMatches: { file_path: "src/**/*.js" } }
        },
        {
          pattern: "List(/home/user)",
          expected: { tool: "list_files", permission: "allow", argumentMatches: { path: "/home/user" } }
        },
        {
          pattern: "Search(TODO)",
          expected: { tool: "search_code", permission: "allow", argumentMatches: { query: "TODO" } }
        },
        {
          pattern: "Fetch(https://api.example.com)",
          expected: { tool: "fetch", permission: "allow", argumentMatches: { url: "https://api.example.com" } }
        }
      ];

      testCases.forEach(({ pattern, expected }) => {
        const policy = parseToolPattern(pattern, "allow");
        expect(policy).toEqual(expected);
      });
    });

    it("should handle empty arguments", () => {
      const policy = parseToolPattern("Write()", "allow");
      
      expect(policy).toEqual({
        tool: "write_file",
        permission: "allow"
      });
    });

    it("should handle whitespace in arguments", () => {
      const policy = parseToolPattern("Bash( npm run test )", "ask");
      
      expect(policy).toEqual({
        tool: "run_terminal_command",
        permission: "ask",
        argumentMatches: {
          command: "npm run test"
        }
      });
    });

    it("should handle unknown tools with default argument key", () => {
      const policy = parseToolPattern("CustomTool(some-pattern)", "allow");
      
      expect(policy).toEqual({
        tool: "CustomTool",
        permission: "allow",
        argumentMatches: {
          pattern: "some-pattern"
        }
      });
    });

    it("should throw error for invalid pattern", () => {
      expect(() => parseToolPattern("Write(unclosed", "allow")).toThrow("Invalid tool pattern: Write(unclosed");
    });

    it("should normalize tool names in patterns", () => {
      const policy = parseToolPattern("write(**/*.ts)", "allow");
      
      expect(policy).toEqual({
        tool: "write_file",
        permission: "allow",
        argumentMatches: {
          file_path: "**/*.ts"
        }
      });
    });
  });
});
