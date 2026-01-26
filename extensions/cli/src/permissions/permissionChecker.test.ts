import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_BUILT_IN_TOOLS } from "src/tools/allBuiltIns.js";

import {
  checkToolPermission,
  matchesArguments,
  matchesToolPattern,
} from "./permissionChecker.js";
import { ToolPermissions } from "./types.js";

// Create a mock function for evaluateToolCallPolicy
const mockEvaluateToolCallPolicy = vi.fn();

// Create a mock Bash tool
const mockBashTool = {
  name: "Bash",
  displayName: "Bash",
  description: "Execute bash commands",
  parameters: {
    type: "object" as const,
    properties: {},
  },
  isBuiltIn: true,
  evaluateToolCallPolicy: mockEvaluateToolCallPolicy,
  run: vi.fn(),
};

// Replace the array contents with our mock tool
ALL_BUILT_IN_TOOLS.length = 0;
ALL_BUILT_IN_TOOLS.push(mockBashTool as any);

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
      expect(
        matchesToolPattern("external_ide_getDiagnostics", "external_*"),
      ).toBe(true);
      expect(matchesToolPattern("external_filesystem_read", "external_*")).toBe(
        true,
      );
      expect(matchesToolPattern("builtin_readFile", "external_*")).toBe(false);
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
      expect(matchesToolPattern("testa", "test[abc]")).toBe(false);
      expect(matchesToolPattern("test[abc]", "test[abc]")).toBe(true);
      expect(matchesToolPattern("test(abc)", "test(abc)")).toBe(true);
      expect(matchesToolPattern("test+plus", "test+plus")).toBe(true);
      expect(matchesToolPattern("test^caret", "test^caret")).toBe(true);
      expect(matchesToolPattern("test$dollar", "test$dollar")).toBe(true);
      expect(matchesToolPattern("test{brace}", "test{brace}")).toBe(true);
      expect(matchesToolPattern("test|pipe", "test|pipe")).toBe(true);
      expect(matchesToolPattern("test\\backslash", "test\\backslash")).toBe(
        true,
      );
    });

    it("should handle wildcard patterns with special regex characters", () => {
      expect(matchesToolPattern("test[abc].txt", "test[abc].*")).toBe(true);
      expect(matchesToolPattern("test[abc]_file", "test[abc].*")).toBe(false);
      expect(matchesToolPattern("external_tool[1]", "external_*")).toBe(true);
      expect(matchesToolPattern("file.test.txt", "*.test.*")).toBe(true);
      expect(matchesToolPattern("(tool)_name", "(tool)*")).toBe(true);
      expect(matchesToolPattern("tool+plus_extra", "tool+plus*")).toBe(true);
    });

    describe("Bash command patterns", () => {
      it("should match Bash command patterns with Bash tool", () => {
        expect(matchesToolPattern("Bash", "Bash(ls*)", { command: "ls" })).toBe(
          true,
        );
        expect(
          matchesToolPattern("Bash", "Bash(ls*)", { command: "ls -la" }),
        ).toBe(true);
        expect(
          matchesToolPattern("Bash", "Bash(ls*)", { command: "pwd" }),
        ).toBe(false);
      });

      it("should match Bash command patterns with Bash display name", () => {
        expect(
          matchesToolPattern("Bash", "Bash(git*)", { command: "git status" }),
        ).toBe(true);
        expect(
          matchesToolPattern("Bash", "Bash(git*)", { command: "git commit" }),
        ).toBe(true);
        expect(
          matchesToolPattern("Bash", "Bash(git*)", { command: "npm install" }),
        ).toBe(false);
      });

      it("should match exact Bash commands", () => {
        expect(matchesToolPattern("Bash", "Bash(ls)", { command: "ls" })).toBe(
          true,
        );
        expect(
          matchesToolPattern("Bash", "Bash(ls)", { command: "ls -la" }),
        ).toBe(false);
      });

      it("should not match Bash patterns for non-bash tools", () => {
        expect(matchesToolPattern("Read", "Bash(ls*)", { command: "ls" })).toBe(
          false,
        );
        expect(
          matchesToolPattern("Write", "Bash(git*)", { command: "git status" }),
        ).toBe(false);
      });

      it("should not match Bash patterns without command argument", () => {
        expect(matchesToolPattern("Bash", "Bash(ls*)", {})).toBe(false);
        expect(
          matchesToolPattern("Bash", "Bash(ls*)", { other: "value" }),
        ).toBe(false);
      });

      it("should handle complex Bash command patterns", () => {
        expect(
          matchesToolPattern("Bash", "Bash(npm*)", { command: "npm install" }),
        ).toBe(true);
        expect(
          matchesToolPattern("Bash", "Bash(npm*)", {
            command: "npm run build",
          }),
        ).toBe(true);
        expect(
          matchesToolPattern("Bash", "Bash(git*commit*)", {
            command: "git commit -m 'test'",
          }),
        ).toBe(true);
      });
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
        options: optionsArray,
      };
      const patterns = {
        config: configObj, // Same reference
        options: optionsArray, // Same reference
      };
      expect(matchesArguments(args, patterns)).toBe(true);

      const differentObjectPatterns = {
        config: { host: "localhost", port: 8080 }, // Different object
      };
      expect(matchesArguments(args, differentObjectPatterns)).toBe(false);

      const differentButEqualObjectPatterns = {
        config: { host: "localhost", port: 3000 }, // Different reference, same content
      };
      expect(matchesArguments(args, differentButEqualObjectPatterns)).toBe(
        false,
      );
    });

    describe("glob pattern matching", () => {
      it("should match glob patterns with asterisk wildcards", () => {
        const args = {
          command: "cd ../projects && ls",
          file_path: "/src/file.ts",
        };

        // Test command patterns
        expect(matchesArguments(args, { command: "cd*" })).toBe(true);
        expect(matchesArguments(args, { command: "*ls" })).toBe(true);
        expect(matchesArguments(args, { command: "*&&*" })).toBe(true);
        expect(matchesArguments(args, { command: "pwd*" })).toBe(false);

        // Test file path patterns
        expect(matchesArguments(args, { file_path: "*.ts" })).toBe(true);
        expect(matchesArguments(args, { file_path: "/src/*" })).toBe(true);
        expect(matchesArguments(args, { file_path: "**/file.ts" })).toBe(true);
        expect(matchesArguments(args, { file_path: "*.js" })).toBe(false);
      });

      it("should match glob patterns with question mark wildcards", () => {
        const args = { command: "git add", file: "test1.js" };

        expect(matchesArguments(args, { command: "git a?d" })).toBe(true);
        expect(matchesArguments(args, { command: "git a??d" })).toBe(false);
        expect(matchesArguments(args, { file: "test?.js" })).toBe(true);
        expect(matchesArguments(args, { file: "test??.js" })).toBe(false);
      });

      it("should match complex glob patterns", () => {
        const args = {
          command: "npm run test:unit",
          path: "/home/user/projects/myapp/src/utils/helper.ts",
        };

        expect(matchesArguments(args, { command: "npm * test:*" })).toBe(true);
        expect(matchesArguments(args, { command: "npm run *:unit" })).toBe(
          true,
        );
        expect(matchesArguments(args, { path: "**/src/**/*.ts" })).toBe(true);
        expect(
          matchesArguments(args, { path: "/home/*/projects/*/src/**" }),
        ).toBe(true);
        expect(matchesArguments(args, { command: "yarn *" })).toBe(false);
      });

      it("should escape special regex characters in glob patterns", () => {
        const args = {
          command: "echo 'test.pattern'",
          regex: "test[0-9]+",
          special: "file(1).txt",
        };

        // Literal dots, brackets, parentheses should match exactly
        expect(matchesArguments(args, { command: "*'test.pattern'*" })).toBe(
          true,
        );
        expect(matchesArguments(args, { regex: "test[0-9]+" })).toBe(true);
        expect(matchesArguments(args, { special: "file(1).txt" })).toBe(true);
        expect(matchesArguments(args, { special: "file(*).txt" })).toBe(true);

        // These should not match due to regex escaping
        expect(matchesArguments(args, { command: "*test_pattern*" })).toBe(
          false,
        );
        expect(matchesArguments(args, { regex: "test*" })).toBe(true); // * is wildcard, + is literal
      });

      it("should handle mixed exact and glob patterns", () => {
        const args = {
          tool: "bash",
          command: "cd projects && npm install",
          flag: "--verbose",
        };

        // Mix of exact and glob matching
        expect(
          matchesArguments(args, {
            tool: "bash", // exact match
            command: "cd*install", // glob match
            flag: "--verbose", // exact match
          }),
        ).toBe(true);

        expect(
          matchesArguments(args, {
            tool: "bash", // exact match
            command: "cd*test", // glob no match
            flag: "--verbose", // exact match
          }),
        ).toBe(false);
      });

      it("should convert non-string values to strings for pattern matching", () => {
        const args = {
          port: 3000,
          enabled: true,
          count: null,
          items: [1, 2, 3],
        };

        expect(matchesArguments(args, { port: "30*" })).toBe(true);
        expect(matchesArguments(args, { enabled: "tr*" })).toBe(true);
        expect(matchesArguments(args, { count: "*" })).toBe(true); // null -> ""
        expect(matchesArguments(args, { items: "*,*,*" })).toBe(true); // array toString

        expect(matchesArguments(args, { port: "40*" })).toBe(false);
        expect(matchesArguments(args, { enabled: "fa*" })).toBe(false);
      });

      it("should handle empty and undefined argument values", () => {
        const args = {
          empty: "",
          undef: undefined,
          zero: 0,
          false_val: false,
        };

        expect(matchesArguments(args, { empty: "*" })).toBe(true);
        expect(matchesArguments(args, { undef: "*" })).toBe(true); // undefined -> ""
        expect(matchesArguments(args, { zero: "*" })).toBe(true); // 0 -> "0"
        expect(matchesArguments(args, { false_val: "*" })).toBe(true); // false -> "false"

        expect(matchesArguments(args, { empty: "nonempty*" })).toBe(false);
        expect(matchesArguments(args, { zero: "1*" })).toBe(false);
      });
    });
  });

  describe("checkToolPermission", () => {
    it("should allow tools with allow permission", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "readFile", permission: "allow" }],
      };

      const result = checkToolPermission(
        { name: "readFile", arguments: { path: "/test.txt" } },
        permissions,
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
        permissions,
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
        permissions,
      );

      expect(result.permission).toBe("exclude");
      expect(result.matchedPolicy?.tool).toBe("runTerminalCommand");
    });

    it("should match wildcard patterns", () => {
      const permissions: ToolPermissions = {
        policies: [
          { tool: "external_*", permission: "ask" },
          { tool: "*", permission: "allow" },
        ],
      };

      const externalResult = checkToolPermission(
        { name: "external_ide_getDiagnostics", arguments: {} },
        permissions,
      );
      expect(externalResult.permission).toBe("ask");
      expect(externalResult.matchedPolicy?.tool).toBe("external_*");

      const builtinResult = checkToolPermission(
        { name: "readFile", arguments: { path: "/test.txt" } },
        permissions,
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
        permissions,
      );
      expect(sensitiveResult.permission).toBe("exclude");

      const normalResult = checkToolPermission(
        {
          name: "writeFile",
          arguments: { path: "/normal.txt", content: "data" },
        },
        permissions,
      );
      expect(normalResult.permission).toBe("allow");
    });

    it("should fall back to ask when no policy matches", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "specificTool", permission: "allow" }],
      };

      const result = checkToolPermission(
        { name: "unknownTool", arguments: {} },
        permissions,
      );

      expect(result.permission).toBe("ask");
    });

    it("should match Bash command patterns in checkToolPermission", () => {
      const permissions: ToolPermissions = {
        policies: [
          { tool: "Bash(ls*)", permission: "allow" },
          { tool: "Bash(git*)", permission: "ask" },
          { tool: "Bash", permission: "ask" }, // Fallback for other commands
        ],
      };

      // Should match "Bash(ls*)" pattern and allow
      const lsResult = checkToolPermission(
        { name: "Bash", arguments: { command: "ls -la" } },
        permissions,
      );
      expect(lsResult.permission).toBe("allow");
      expect(lsResult.matchedPolicy?.tool).toBe("Bash(ls*)");

      // Should match "Bash(git*)" pattern and ask
      const gitResult = checkToolPermission(
        { name: "Bash", arguments: { command: "git status" } },
        permissions,
      );
      expect(gitResult.permission).toBe("ask");
      expect(gitResult.matchedPolicy?.tool).toBe("Bash(git*)");

      // Should match general fallback for other commands
      const npmResult = checkToolPermission(
        { name: "Bash", arguments: { command: "npm install" } },
        permissions,
      );
      expect(npmResult.permission).toBe("ask");
      expect(npmResult.matchedPolicy?.tool).toBe("Bash");
    });

    it("should match argument patterns with glob patterns", () => {
      const permissions: ToolPermissions = {
        policies: [
          {
            tool: "Bash",
            permission: "exclude",
            argumentMatches: { command: "rm*" },
          },
          {
            tool: "Write",
            permission: "ask",
            argumentMatches: { file_path: "**/*.ts" },
          },
          {
            tool: "Write",
            permission: "allow",
          },
        ],
      };

      // Should exclude dangerous rm commands
      const rmResult = checkToolPermission(
        { name: "Bash", arguments: { command: "rm -rf /" } },
        permissions,
      );
      expect(rmResult.permission).toBe("exclude");
      expect(rmResult.matchedPolicy?.argumentMatches?.command).toBe("rm*");

      // Should ask for TypeScript files
      const tsResult = checkToolPermission(
        {
          name: "Write",
          arguments: { file_path: "/src/components/Button.ts" },
        },
        permissions,
      );
      expect(tsResult.permission).toBe("ask");
      expect(tsResult.matchedPolicy?.argumentMatches?.file_path).toBe(
        "**/*.ts",
      );

      // Should allow other file writes
      const jsResult = checkToolPermission(
        { name: "Write", arguments: { file_path: "/src/utils/helper.js" } },
        permissions,
      );
      expect(jsResult.permission).toBe("allow");
      expect(jsResult.matchedPolicy?.argumentMatches).toBeUndefined();
    });
  });

  describe("Hybrid Permission Model with Dynamic Evaluation", () => {
    beforeEach(() => {
      // Reset mock between tests
      mockEvaluateToolCallPolicy.mockClear();
    });

    describe("User has Bash in 'allow' mode", () => {
      const permissions: ToolPermissions = {
        policies: [
          { tool: "Bash", permission: "allow" },
          { tool: "*", permission: "ask" },
        ],
      };

      it("should allow safe commands (echo hello)", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithoutPermission");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "echo hello" } },
          permissions,
        );

        expect(result.permission).toBe("allow"); // User preference wins
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithoutPermission", // converted from "allow"
          { command: "echo hello" },
        );
      });

      it("should allow risky commands based on user preference (curl)", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithPermission");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "curl https://example.com" } },
          permissions,
        );

        expect(result.permission).toBe("allow"); // User preference wins over "ask"
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithoutPermission", // converted from "allow"
          { command: "curl https://example.com" },
        );
      });

      it("should block dangerous commands despite user preference (eval)", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("disabled");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "eval 'echo safe'" } },
          permissions,
        );

        expect(result.permission).toBe("exclude"); // Security wins
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithoutPermission", // converted from "allow"
          { command: "eval 'echo safe'" },
        );
      });

      it("should block sudo commands despite user preference", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("disabled");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "sudo rm -rf /" } },
          permissions,
        );

        expect(result.permission).toBe("exclude"); // Security wins
      });
    });

    describe("User has Bash in 'ask' mode (default)", () => {
      const permissions: ToolPermissions = {
        policies: [
          { tool: "Bash", permission: "ask" },
          { tool: "*", permission: "ask" },
        ],
      };

      it("should ask for safe commands based on user preference (echo)", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithoutPermission");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "echo hello" } },
          permissions,
        );

        expect(result.permission).toBe("ask"); // User preference wins
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithPermission", // converted from "ask"
          { command: "echo hello" },
        );
      });

      it("should ask for risky commands (curl)", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithPermission");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "curl https://example.com" } },
          permissions,
        );

        expect(result.permission).toBe("ask"); // Both agree on "ask"
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithPermission", // converted from "ask"
          { command: "curl https://example.com" },
        );
      });

      it("should block dangerous commands (eval)", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("disabled");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "eval 'echo safe'" } },
          permissions,
        );

        expect(result.permission).toBe("exclude"); // Security wins
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithPermission", // converted from "ask"
          { command: "eval 'echo safe'" },
        );
      });

      it("should block rm -rf commands", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("disabled");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "rm -rf /tmp/important" } },
          permissions,
        );

        expect(result.permission).toBe("exclude"); // Security wins
      });
    });

    describe("User has Bash in 'exclude' mode", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "Bash", permission: "exclude" }],
      };

      it("should always exclude regardless of dynamic evaluation", () => {
        // Even if dynamic evaluation would allow it
        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithoutPermission");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "echo hello" } },
          permissions,
        );

        expect(result.permission).toBe("exclude"); // User excluded the tool entirely
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "disabled", // converted from "exclude"
          { command: "echo hello" },
        );
      });
    });

    describe("Comprehensive command testing", () => {
      const permissions: ToolPermissions = {
        policies: [{ tool: "Bash", permission: "allow" }],
      };

      const testCases = [
        // Safe commands
        {
          command: "ls",
          dynamicResult: "allowedWithoutPermission",
          expected: "allow",
        },
        {
          command: "pwd",
          dynamicResult: "allowedWithoutPermission",
          expected: "allow",
        },
        {
          command: "date",
          dynamicResult: "allowedWithoutPermission",
          expected: "allow",
        },
        {
          command: "echo test",
          dynamicResult: "allowedWithoutPermission",
          expected: "allow",
        },
        {
          command: "git status",
          dynamicResult: "allowedWithoutPermission",
          expected: "allow",
        },

        // Risky commands (user preference wins when not disabled)
        {
          command: "npm install pkg",
          dynamicResult: "allowedWithPermission",
          expected: "allow",
        },
        {
          command: "rm file.txt",
          dynamicResult: "allowedWithPermission",
          expected: "allow",
        },
        {
          command: "curl https://api.example.com",
          dynamicResult: "allowedWithPermission",
          expected: "allow",
        },
        {
          command: "wget https://example.com/file",
          dynamicResult: "allowedWithPermission",
          expected: "allow",
        },

        // Dangerous commands (always blocked)
        {
          command: "sudo rm -rf /",
          dynamicResult: "disabled",
          expected: "exclude",
        },
        {
          command: "exec bash",
          dynamicResult: "disabled",
          expected: "exclude",
        },
        {
          command: "eval 'malicious code'",
          dynamicResult: "disabled",
          expected: "exclude",
        },
        { command: "rm -rf /", dynamicResult: "disabled", expected: "exclude" },
      ];

      testCases.forEach(({ command, dynamicResult, expected }) => {
        it(`should handle '${command}' correctly`, () => {
          mockEvaluateToolCallPolicy.mockReturnValue(dynamicResult);

          const result = checkToolPermission(
            { name: "Bash", arguments: { command } },
            permissions,
          );

          expect(result.permission).toBe(expected);
        });
      });
    });

    describe("Edge cases", () => {
      it("should handle tools without dynamic evaluation", () => {
        const permissions: ToolPermissions = {
          policies: [{ tool: "Read", permission: "allow" }],
        };

        const result = checkToolPermission(
          { name: "Read", arguments: { path: "/tmp/file.txt" } },
          permissions,
        );

        expect(result.permission).toBe("allow");
        expect(mockEvaluateToolCallPolicy).not.toHaveBeenCalled();
      });

      it("should use default 'ask' when no policy matches", () => {
        const permissions: ToolPermissions = {
          policies: [],
        };

        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithPermission");

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "echo test" } },
          permissions,
        );

        expect(result.permission).toBe("ask"); // Default fallback, user preference wins
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithPermission", // converted from default "ask"
          { command: "echo test" },
        );
      });

      it("should handle null/undefined arguments gracefully", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithPermission");

        const permissions: ToolPermissions = {
          policies: [{ tool: "Bash", permission: "allow" }],
        };

        const result = checkToolPermission(
          { name: "Bash", arguments: {} },
          permissions,
        );

        expect(result.permission).toBe("allow");
        expect(mockEvaluateToolCallPolicy).toHaveBeenCalledWith(
          "allowedWithoutPermission",
          {},
        );
      });

      it("should maintain matched policy information", () => {
        mockEvaluateToolCallPolicy.mockReturnValue("allowedWithoutPermission");

        const policy = { tool: "Bash", permission: "allow" as const };
        const permissions: ToolPermissions = {
          policies: [policy],
        };

        const result = checkToolPermission(
          { name: "Bash", arguments: { command: "ls" } },
          permissions,
        );

        expect(result.matchedPolicy).toBe(policy);
      });
    });
  });
});
