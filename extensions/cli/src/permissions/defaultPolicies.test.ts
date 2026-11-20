import { describe, expect, it } from "vitest";

import {
  getDefaultToolPolicies,
  PLAN_MODE_POLICIES,
} from "./defaultPolicies.js";
const DEFAULT_TOOL_POLICIES = getDefaultToolPolicies();

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

  it("should not have prefix wildcard policies in defaults", () => {
    const prefixWildcardPolicy = DEFAULT_TOOL_POLICIES.find(
      (p) => p.tool.endsWith("*") && p.tool !== "*",
    );
    expect(prefixWildcardPolicy).toBeUndefined();
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

describe("PLAN_MODE_POLICIES", () => {
  it("should require confirmation for Bash in plan mode", () => {
    const bashPolicy = PLAN_MODE_POLICIES.find((p) => p.tool === "Bash");
    expect(bashPolicy).toEqual({ tool: "Bash", permission: "ask" });
  });

  it("should exclude write tools in plan mode", () => {
    const writeTools = ["Write", "Edit", "MultiEdit"];
    for (const tool of writeTools) {
      const policy = PLAN_MODE_POLICIES.find((p) => p.tool === tool);
      expect(policy).toEqual({ tool, permission: "exclude" });
    }
  });

  it("should allow read-only tools in plan mode", () => {
    const readOnlyTools = [
      "Read",
      "List",
      "Search",
      "Fetch",
      "Exit",
      "Diff",
      "Checklist",
      "CheckBackgroundJob",
      "AskQuestion",
      "ReportFailure",
      "Skills",
      "Status",
      "UploadArtifact",
    ];

    for (const tool of readOnlyTools) {
      const policy = PLAN_MODE_POLICIES.find((p) => p.tool === tool);
      expect(policy).toEqual({ tool, permission: "allow" });
    }
  });

  it("should allow MCP tools with wildcard in plan mode", () => {
    const catchAllPolicy = PLAN_MODE_POLICIES.find((p) => p.tool === "*");
    expect(catchAllPolicy).toEqual({ tool: "*", permission: "allow" });
  });
});
