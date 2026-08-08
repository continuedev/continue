import { describe, expect, it } from "vitest";
import { RuleWithSource } from "../..";
import { shouldApplyRule } from "./getSystemMessageWithRules";

describe("File Path Protocol Matching", () => {
  // Test rule with a file:// protocol in the path - simulating what happens in VSCode
  const ruleWithFileProtocol: RuleWithSource = {
    name: "Rule with file:// protocol",
    rule: "This is a test rule",
    source: "rules-block",
    sourceFile: "file:///Users/user/project/nested-folder/rules.md",
  };

  it("should match relative paths with file:// protocol paths", () => {
    // This is the key test case that would have failed before:
    // A relative path should match with a file:// protocol directory path
    const relativePaths = ["nested-folder/example.py"];

    // Before the fix, this would have failed because the string comparison
    // would be checking if 'nested-folder/example.py' starts with
    // 'file:///Users/user/project/nested-folder/'
    expect(shouldApplyRule(ruleWithFileProtocol, relativePaths)).toBe(true);
  });

  it("should match when directory name appears in the path", () => {
    // Even with a more complex relative path, it should match as long as
    // it contains the right directory structure
    const nestedPaths = ["src/components/nested-folder/example.py"];
    expect(shouldApplyRule(ruleWithFileProtocol, nestedPaths)).toBe(true);
  });

  it("should not match when directory name is not in the path", () => {
    // Should not match when the path doesn't contain the directory name
    const unrelatedPaths = ["src/components/other-folder/example.py"];
    expect(shouldApplyRule(ruleWithFileProtocol, unrelatedPaths)).toBe(false);
  });

  it("should match absolute paths with the same protocol", () => {
    // Should also work with absolute paths
    const absolutePaths = [
      "file:///Users/user/project/nested-folder/example.py",
    ];
    expect(shouldApplyRule(ruleWithFileProtocol, absolutePaths)).toBe(true);
  });

  it("should handle mixed path types in the same call", () => {
    // Should handle a mix of relative and absolute paths
    const mixedPaths = [
      "nested-folder/example.py",
      "file:///Users/user/project/nested-folder/other.py",
      "src/unrelated/file.py",
    ];
    expect(shouldApplyRule(ruleWithFileProtocol, mixedPaths)).toBe(true);
  });
});
