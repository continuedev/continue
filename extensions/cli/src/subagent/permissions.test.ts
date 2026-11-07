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
    {
      tool: "Bash",
      permission: "allow",
      argumentMatches: { command: "git status*" },
    },
    { tool: "Edit", permission: "ask" },
    { tool: "Read", permission: "allow" },
  ],
};

const check = (
  name: string,
  args: Record<string, unknown> = {},
  permissions: ToolPermissions = parent,
) =>
  checkToolPermission(
    { name, arguments: args },
    subagentPermissions(permissions),
  ).permission;

describe("subagentPermissions", () => {
  it("keeps the parent's excludes", () => {
    expect(check("Write")).toBe("exclude");
    expect(check("Bash", { command: "rm -rf /tmp/x" })).toBe("exclude");
  });

  it("allows what the parent allows without asking", () => {
    expect(check("Read")).toBe("allow");
    expect(check("Bash", { command: "git status --short" })).toBe("allow");
  });

  it("refuses what the parent would ask about, since a subagent cannot prompt", () => {
    expect(check("Edit")).toBe("exclude");
  });

  it("refuses tools no policy matches, which the parent would ask about", () => {
    expect(check("Bash", { command: "npm install" })).toBe("exclude");
    expect(check("SomeMcpTool")).toBe("exclude");
    expect(
      check("Anything", {}, { policies: [{ tool: "*", permission: "ask" }] }),
    ).toBe("exclude");
  });

  it("keeps a parent that allows everything (auto mode) able to do everything", () => {
    expect(
      check(
        "Bash",
        { command: "npm test" },
        {
          policies: [{ tool: "*", permission: "allow" }],
        },
      ),
    ).toBe("allow");
  });

  describe("when the parent's prompt can be reached", () => {
    const checkPrompting = (
      name: string,
      args: Record<string, unknown> = {},
      permissions: ToolPermissions = parent,
    ) =>
      checkToolPermission(
        { name, arguments: args },
        subagentPermissions(permissions, { canPrompt: true }),
      ).permission;

    it("keeps 'ask' as 'ask' so the person decides", () => {
      expect(checkPrompting("Edit")).toBe("ask");
      expect(checkPrompting("Bash", { command: "npm install" })).toBe("ask");
      expect(checkPrompting("SomeMcpTool")).toBe("ask");
    });

    it("still keeps the parent's excludes and allows", () => {
      expect(checkPrompting("Write")).toBe("exclude");
      expect(checkPrompting("Bash", { command: "rm -rf /tmp/x" })).toBe(
        "exclude",
      );
      expect(checkPrompting("Read")).toBe("allow");
    });

    it("still never lets a subagent start another subagent", () => {
      expect(
        checkPrompting(
          "Subagent",
          {},
          { policies: [{ tool: "*", permission: "allow" }] },
        ),
      ).toBe("exclude");
    });
  });

  it("never lets a subagent start another subagent", () => {
    expect(check("Subagent")).toBe("exclude");
    expect(
      check("Subagent", {}, { policies: [{ tool: "*", permission: "allow" }] }),
    ).toBe("exclude");
  });

  it("never lets a subagent write the parent's task list", () => {
    const allowAll: ToolPermissions = {
      policies: [{ tool: "*", permission: "allow" }],
    };
    for (const tool of ["TaskList", "Checklist"]) {
      expect(check(tool, {}, allowAll)).toBe("exclude");
      expect(
        checkToolPermission(
          { name: tool, arguments: {} },
          subagentPermissions(allowAll, { canPrompt: true }),
        ).permission,
      ).toBe("exclude");
    }
  });
});
