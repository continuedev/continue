import { describe, it, expect } from "vitest";

import { DEFAULT_TOOL_POLICIES } from "./defaultPolicies.js";

describe("defaultPolicies", () => {
  it("should have correct permissions for read-only tools", () => {
    const readOnlyTools = [
      "Read",
      "List",
      "Search",
      "Fetch",
      "Exit",
      "Diff",
      "Checklist",
    ];

    for (const tool of readOnlyTools) {
      const policy = DEFAULT_TOOL_POLICIES.find((p) => p.tool === tool);
      expect(policy, `Policy should exist for ${tool}`).toBeDefined();
      expect(policy?.permission, `${tool} should be allowed`).toBe("allow");
    }
  });

  it("should have correct permissions for write tools", () => {
    const writeTools = ["Write", "Edit", "MultiEdit", "Bash"];

    for (const tool of writeTools) {
      const policy = DEFAULT_TOOL_POLICIES.find((p) => p.tool === tool);
      expect(policy, `Policy should exist for ${tool}`).toBeDefined();
      expect(policy?.permission, `${tool} should require confirmation`).toBe(
        "ask",
      );
    }
  });

  it("should have a catch-all policy", () => {
    const catchAllPolicy = DEFAULT_TOOL_POLICIES.find((p) => p.tool === "*");
    expect(catchAllPolicy).toBeDefined();
    expect(catchAllPolicy?.permission).toBe("ask");
  });

  it("should include MultiEdit policy", () => {
    const multiEditPolicy = DEFAULT_TOOL_POLICIES.find(
      (p) => p.tool === "MultiEdit",
    );
    expect(multiEditPolicy).toBeDefined();
    expect(multiEditPolicy?.permission).toBe("ask");
  });

  it("should have policies in correct order", () => {
    // The catch-all policy should be last
    const catchAllIndex = DEFAULT_TOOL_POLICIES.findIndex(
      (p) => p.tool === "*",
    );
    expect(catchAllIndex).toBe(DEFAULT_TOOL_POLICIES.length - 1);
  });
});
