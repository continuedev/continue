import { generatePolicyRule } from "./policyWriter.js";

describe("policyWriter verification", () => {
  it("should return display names for all tools", () => {
    // Test Edit tool
    expect(generatePolicyRule("Edit", { filepath: "test.txt" })).toBe("Edit");

    // Test Write tool
    expect(generatePolicyRule("Write", { filepath: "test.txt" })).toBe("Write");

    // Test Read tool
    expect(generatePolicyRule("Read", { filepath: "test.txt" })).toBe("Read");

    // Test Bash tool with commands
    expect(generatePolicyRule("Bash", { command: "ls -la" })).toBe("Bash(ls*)");
  });

  it("should use exact tool names without case normalization", () => {
    expect(generatePolicyRule("edit", { filepath: "test.txt" })).toBe("edit");
    expect(generatePolicyRule("EDIT", { filepath: "test.txt" })).toBe("EDIT");
    expect(generatePolicyRule("Edit", { filepath: "test.txt" })).toBe("Edit");
  });
});
