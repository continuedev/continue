import { describe, expect, it } from "vitest";

import { checkToolPermission } from "../permissions/permissionChecker.js";
import type { ToolPermissions } from "../permissions/types.js";

import { subagentPermissions } from "./permissions.js";

const parent: ToolPermissions = {
  policies: [
    { tool: "Write", permission: "exclude" },
    {
      tool: "Bash",
      permission: "exclude",
      argumentMatches: { command: "rm*" },
    },
    { tool: "Edit", permission: "ask" },
    { tool: "Read", permission: "allow" },
  ],
};

const check = (name: string, args: Record<string, unknown> = {}) =>
  checkToolPermission({ name, arguments: args }, subagentPermissions(parent))
    .permission;

describe("subagentPermissions", () => {
  it("keeps the parent's excludes", () => {
    expect(check("Write")).toBe("exclude");
    expect(check("Bash", { command: "rm -rf /tmp/x" })).toBe("exclude");
  });

  it("allows what the parent would ask about, since a subagent cannot prompt", () => {
    expect(check("Edit")).toBe("allow");
    expect(check("Bash", { command: "ls" })).toBe("allow");
  });

  it("allows everything when the parent excludes nothing (previous behaviour)", () => {
    expect(
      subagentPermissions({ policies: [{ tool: "*", permission: "ask" }] }),
    ).toEqual({ policies: [{ tool: "*", permission: "allow" }] });
  });
});
