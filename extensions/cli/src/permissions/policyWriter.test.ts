import { generatePolicyRule } from "./policyWriter.js";

describe("policyWriter", () => {
  describe("generatePolicyRule", () => {
    it("should return display name for regular tools", () => {
      expect(generatePolicyRule("Read", { file_path: "/test" })).toBe("Read");
      expect(
        generatePolicyRule("Write", { file_path: "/test", content: "test" }),
      ).toBe("Write");
      expect(generatePolicyRule("List", { path: "/test" })).toBe("List");
      expect(generatePolicyRule("Search", { pattern: "test" })).toBe("Search");
      expect(generatePolicyRule("Grep", { pattern: "test" })).toBe("Grep"); // Unknown tool, passes through
    });

    it("should generate command-specific patterns for Bash tool", () => {
      expect(generatePolicyRule("Bash", { command: "ls -la" })).toBe(
        "Bash(ls*)",
      );
      expect(generatePolicyRule("Bash", { command: "git status" })).toBe(
        "Bash(git*)",
      );
      expect(generatePolicyRule("Bash", { command: "npm install" })).toBe(
        "Bash(npm*)",
      );
    });

    it("should handle complex bash commands", () => {
      expect(
        generatePolicyRule("Bash", { command: "ls -la && echo test" }),
      ).toBe("Bash(ls*)");
      expect(
        generatePolicyRule("Bash", {
          command: "find . -name '*.ts' | head -10",
        }),
      ).toBe("Bash(find*)");
      expect(
        generatePolicyRule("Bash", { command: "  grep -r test .  " }),
      ).toBe("Bash(grep*)");
    });

    it("should fallback to display name for bash tools without command", () => {
      expect(generatePolicyRule("Bash", {})).toBe("Bash");
      expect(generatePolicyRule("Bash", { command: "" })).toBe("Bash");
      expect(generatePolicyRule("Bash", { command: "   " })).toBe("Bash");
    });

    it("should use exact tool names without normalization", () => {
      expect(generatePolicyRule("bash", { command: "ls" })).toBe("bash");
      expect(generatePolicyRule("BASH", { command: "pwd" })).toBe("BASH");
      expect(generatePolicyRule("read", { file_path: "/test" })).toBe("read");
      expect(
        generatePolicyRule("write", { file_path: "/test", content: "test" }),
      ).toBe("write");
    });
  });
});
