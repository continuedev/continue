import { describe, expect, it } from "vitest";

import { PLAN_MODE_POLICIES } from "./defaultPolicies.js";
import { checkToolPermission } from "./permissionChecker.js";
import { withReadOnlyMcp } from "./readOnlyMcp.js";

const planMode = { policies: PLAN_MODE_POLICIES };
const check = (name: string, permissions = planMode) =>
  checkToolPermission({ name, arguments: {} }, permissions);

describe("read-only MCP tools", () => {
  const readOnly = { readonly: true, isBuiltIn: false };

  it("run without asking, in plan mode too", () => {
    expect(withReadOnlyMcp(check("docs_search"), readOnly).permission).toBe(
      "allow",
    );
  });

  it("still ask when the server does not say read-only", () => {
    expect(
      withReadOnlyMcp(check("github_create_issue"), {
        readonly: undefined,
        isBuiltIn: false,
      }).permission,
    ).toBe("ask");
  });

  it("do not change a built-in tool", () => {
    expect(
      withReadOnlyMcp(check("Bash"), { readonly: true, isBuiltIn: true })
        .permission,
    ).toBe("ask");
  });

  it("give way to a rule that names the tool", () => {
    const named = {
      policies: [{ tool: "docs_search", permission: "ask" as const }],
    };
    expect(
      withReadOnlyMcp(check("docs_search", named), readOnly).permission,
    ).toBe("ask");
  });
});
