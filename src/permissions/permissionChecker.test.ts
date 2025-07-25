import {
  checkToolPermission,
  filterExcludedTools,
  matchesToolPattern,
  matchesArguments,
} from "./permissionChecker.js";
import { ToolPermissions } from "./types.js";

describe("Permission Checker", () => {
  describe("matchesToolPattern", () => {
    it("should match exact tool names", () => {
      expect(matchesToolPattern("readFile", "readFile")).toBe(true);
      expect(matchesToolPattern("writeFile", "readFile")).toBe(false);
    });

    it("should match universal wildcard", () => {
      expect(matchesToolPattern("anyTool", "*")).toBe(true);
      expect(matchesToolPattern("readFile", "*")).toBe(true);
      expect(matchesToolPattern("", "*")).toBe(true);
    });

    it("should match prefix wildcards", () => {
      expect(matchesToolPattern("mcp__ide__getDiagnostics", "mcp__*")).toBe(true);
      expect(matchesToolPattern("mcp__filesystem__read", "mcp__*")).toBe(true);
      expect(matchesToolPattern("builtin__readFile", "mcp__*")).toBe(false);
    });

    it("should match suffix wildcards", () => {
      expect(matchesToolPattern("readFile", "*File")).toBe(true);
      expect(matchesToolPattern("writeFile", "*File")).toBe(true);
      expect(matchesToolPattern("readData", "*File")).toBe(false);
    });

    it("should match complex wildcard patterns", () => {
      expect(matchesToolPattern("test_function_123", "test_*_123")).toBe(true);
      expect(matchesToolPattern("test_abc_123", "test_*_123")).toBe(true);
      expect(matchesToolPattern("test_function_456", "test_*_123")).toBe(false);
    });

    it("should handle empty strings", () => {
      expect(matchesToolPattern("", "")).toBe(true);
      expect(matchesToolPattern("tool", "")).toBe(false);
      expect(matchesToolPattern("", "tool")).toBe(false);
    });

    it("should handle special regex characters in patterns", () => {
      expect(matchesToolPattern("test.file", "test.file")).toBe(true);
      expect(matchesToolPattern("test_file", "test.file")).toBe(false);
      expect(matchesToolPattern("test[file]", "test[file]")).toBe(true);
    });
  });

  describe("matchesArguments", () => {
    it("should return true when no patterns provided", () => {
      expect(matchesArguments({ path: "/test.txt" })).toBe(true);
      expect(matchesArguments({})).toBe(true);
      expect(matchesArguments({ any: "value" }, undefined)).toBe(true);
    });

    it("should match exact argument values", () => {
      const args = { path: "/test.txt", mode: "read" };
      const patterns = { path: "/test.txt" };
      expect(matchesArguments(args, patterns)).toBe(true);
      
      const nonMatchingPatterns = { path: "/other.txt" };
      expect(matchesArguments(args, nonMatchingPatterns)).toBe(false);
    });

    it("should match wildcard argument patterns", () => {
      const args = { path: "/any/file.txt", mode: "write" };
      const patterns = { path: "*", mode: "write" };
      expect(matchesArguments(args, patterns)).toBe(true);
      
      const wildcardOnlyPatterns = { path: "*" };
      expect(matchesArguments(args, wildcardOnlyPatterns)).toBe(true);
    });

    it("should require all patterns to match", () => {
      const args = { path: "/test.txt", mode: "read", format: "json" };
      const allMatchingPatterns = { path: "/test.txt", mode: "read" };
      expect(matchesArguments(args, allMatchingPatterns)).toBe(true);
      
      const partialMatchingPatterns = { path: "/test.txt", mode: "write" };
      expect(matchesArguments(args, partialMatchingPatterns)).toBe(false);
    });

    it("should handle missing arguments", () => {
      const args = { path: "/test.txt" };
      const patternsRequiringMissing = { path: "/test.txt", mode: "read" };
      expect(matchesArguments(args, patternsRequiringMissing)).toBe(false);
    });

    it("should handle different data types", () => {
      const args = { count: 42, enabled: true, data: null, list: [1, 2, 3] };
      const patterns = { count: 42, enabled: true };
      expect(matchesArguments(args, patterns)).toBe(true);
      
      const mismatchedPatterns = { count: "42" }; // string vs number
      expect(matchesArguments(args, mismatchedPatterns)).toBe(false);
    });

    it("should handle complex object arguments with reference equality", () => {
      const configObj = { host: "localhost", port: 3000 };
      const optionsArray = ["verbose", "debug"];
      
      const args = { 
        config: configObj,
        options: optionsArray
      };
      const patterns = { 
        config: configObj, // Same reference
        options: optionsArray // Same reference
      };
      expect(matchesArguments(args, patterns)).toBe(true);
      
      const differentObjectPatterns = { 
        config: { host: "localhost", port: 8080 } // Different object
      };
      expect(matchesArguments(args, differentObjectPatterns)).toBe(false);
      
      const differentButEqualObjectPatterns = { 
        config: { host: "localhost", port: 3000 } // Different reference, same content
      };
      expect(matchesArguments(args, differentButEqualObjectPatterns)).toBe(false);
    });
  });

  describe("checkToolPermission", () => {
    it("should allow tools with allow permission", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "readFile", permission: "allow" }],
      };

      const result = checkToolPermission(
        { name: "readFile", arguments: { path: "/test.txt" } },
        permissions
      );

      expect(result.permission).toBe("allow");
      expect(result.matchedPolicy?.tool).toBe("readFile");
    });

    it("should ask for tools with ask permission", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "writeFile", permission: "ask" }],
      };

      const result = checkToolPermission(
        {
          name: "writeFile",
          arguments: { path: "/test.txt", content: "hello" },
        },
        permissions
      );

      expect(result.permission).toBe("ask");
      expect(result.matchedPolicy?.tool).toBe("writeFile");
    });

    it("should exclude tools with exclude permission", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "runTerminalCommand", permission: "exclude" }],
      };

      const result = checkToolPermission(
        { name: "runTerminalCommand", arguments: { command: "rm -rf /" } },
        permissions
      );

      expect(result.permission).toBe("exclude");
      expect(result.matchedPolicy?.tool).toBe("runTerminalCommand");
    });

    it("should match wildcard patterns", () => {
      const permissions: ToolPermissions = {
        policies: [
          { tool: "mcp__*", permission: "ask" },
          { tool: "*", permission: "allow" },
        ],
      };

      const mcpResult = checkToolPermission(
        { name: "mcp__ide__getDiagnostics", arguments: {} },
        permissions
      );
      expect(mcpResult.permission).toBe("ask");
      expect(mcpResult.matchedPolicy?.tool).toBe("mcp__*");

      const builtinResult = checkToolPermission(
        { name: "readFile", arguments: { path: "/test.txt" } },
        permissions
      );
      expect(builtinResult.permission).toBe("allow");
      expect(builtinResult.matchedPolicy?.tool).toBe("*");
    });

    it("should match based on arguments", () => {
      const permissions: ToolPermissions = {
        policies: [
          {
            tool: "writeFile",
            permission: "exclude",
            argumentMatches: { path: "/sensitive.txt" },
          },
          { tool: "writeFile", permission: "allow" },
        ],
      };

      const sensitiveResult = checkToolPermission(
        {
          name: "writeFile",
          arguments: { path: "/sensitive.txt", content: "data" },
        },
        permissions
      );
      expect(sensitiveResult.permission).toBe("exclude");

      const normalResult = checkToolPermission(
        {
          name: "writeFile",
          arguments: { path: "/normal.txt", content: "data" },
        },
        permissions
      );
      expect(normalResult.permission).toBe("allow");
    });

    it("should use default policies when no custom permissions provided", () => {
      const result = checkToolPermission({
        name: "readFile",
        arguments: { path: "/test.txt" },
      });

      // Should match the default policies (readFile should be "allow")
      expect(result.permission).toBe("allow");
    });

    it("should fall back to ask when no policy matches", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "specificTool", permission: "allow" }],
      };

      const result = checkToolPermission(
        { name: "unknownTool", arguments: {} },
        permissions
      );

      expect(result.permission).toBe("ask");
    });
  });

  describe("filterExcludedTools", () => {
    it("should filter out excluded tools", () => {
      const permissions: ToolPermissions = {
        policies: [
          { tool: "runTerminalCommand", permission: "exclude" },
          { tool: "writeFile", permission: "ask" },
          { tool: "*", permission: "allow" },
        ],
      };

      const tools = [
        "readFile",
        "writeFile",
        "runTerminalCommand",
        "searchCode",
      ];
      const filtered = filterExcludedTools(tools, permissions);

      expect(filtered).toEqual(["readFile", "writeFile", "searchCode"]);
      expect(filtered).not.toContain("runTerminalCommand");
    });

    it("should return all tools when none are excluded", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "*", permission: "allow" }],
      };

      const tools = ["readFile", "writeFile", "runTerminalCommand"];
      const filtered = filterExcludedTools(tools, permissions);

      expect(filtered).toEqual(tools);
    });

    it("should use default policies when no permissions provided", () => {
      const tools = ["readFile", "writeFile", "runTerminalCommand"];
      const filtered = filterExcludedTools(tools);

      // All tools should be included (none excluded by default)
      expect(filtered).toEqual(tools);
    });
  });
});
