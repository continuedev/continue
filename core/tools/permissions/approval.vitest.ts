import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import { describe, expect, it } from "vitest";
import type { ApprovalSettings } from "./approval";
import { categoryOfTool } from "./approval";
import { evaluateToolPolicyWithRules } from "./evaluate";

const ASK = "allowedWithPermission" as const;
const ALLOW = "allowedWithoutPermission" as const;
const OFF = "disabled" as const;

const terminalTool = {
  group: "Built-In",
  evaluateToolCallPolicy: (base: any, args: Record<string, unknown>) =>
    evaluateTerminalCommandSecurity(base, args.command as string),
};
/** Asks for a file outside the workspace, like evaluateFileAccessPolicy. */
const readTool = {
  group: "Built-In",
  evaluateToolCallPolicy: (base: any, args: Record<string, unknown>) =>
    base === OFF
      ? OFF
      : String(args.filepath).startsWith("/outside")
        ? ASK
        : base,
};
const mcpTool = (group: string) => ({
  group,
  uri: `mcp://${group}`,
  originalFunctionName: "query",
});
const plain = { group: "Built-In" };

const approve = (
  toolName: string,
  tool: any,
  parsedArgs: Record<string, unknown>,
  approval: ApprovalSettings | undefined,
  extra: { permissions?: any; basePolicy?: any } = {},
) =>
  evaluateToolPolicyWithRules({
    tool,
    toolName,
    basePolicy: extra.basePolicy ?? ASK,
    parsedArgs,
    permissions: extra.permissions,
    approval,
  });

const cmd = (
  command: string,
  approval: ApprovalSettings | undefined,
  extra?: { permissions?: any; basePolicy?: any },
) =>
  approve("run_terminal_command", terminalTool, { command }, approval, extra);

describe("categoryOfTool", () => {
  it("maps tools to switches", () => {
    expect(categoryOfTool("read_file", undefined)).toBe("readFiles");
    expect(categoryOfTool("ls", undefined)).toBe("readFiles");
    expect(categoryOfTool("grep_search", undefined)).toBe("readFiles");
    expect(categoryOfTool("edit_existing_file", undefined)).toBe("editFiles");
    expect(categoryOfTool("run_terminal_command", undefined)).toBe(
      "runSafeCommands",
    );
    expect(categoryOfTool("fetch_url_content", undefined)).toBe("browser");
    expect(categoryOfTool("search_web", undefined)).toBe("browser");
    expect(categoryOfTool("query", { uri: "mcp://x" })).toBe("mcp");
    expect(categoryOfTool("create_rule_block", undefined)).toBeUndefined();
  });
});

describe("Manual changes nothing", () => {
  it("leaves an ask as an ask, with or without an approval object", () => {
    expect(cmd("npm test", undefined).policy).toBe(ASK);
    expect(cmd("npm test", { mode: "manual" }).policy).toBe(ASK);
    expect(
      cmd("npm test", { mode: "manual", categories: { runAllCommands: true } })
        .policy,
    ).toBe(ASK);
  });
  it("ignores an unknown mode", () => {
    expect(cmd("npm test", { mode: "bogus" as any }).policy).toBe(ASK);
  });
});

describe("category switches (Auto-approve)", () => {
  const mode = "autoApprove" as const;

  it("run safe commands allows a command the floor calls safe", () => {
    const r = cmd("ls -la", { mode, categories: { runSafeCommands: true } });
    expect(r.policy).toBe(ALLOW);
    expect(r.source).toBe("category");
    expect(r.reason).toMatch(/Run safe commands/);
  });

  it("run safe commands does not allow a command the floor asks about", () => {
    const r = cmd("git push origin main", {
      mode,
      categories: { runSafeCommands: true },
    });
    expect(r.policy).toBe(ASK);
  });

  it("run all commands allows what the floor asks about", () => {
    const r = cmd("git push origin main", {
      mode,
      categories: { runAllCommands: true },
    });
    expect(r.policy).toBe(ALLOW);
    expect(r.source).toBe("category");
  });

  it("run all commands never allows a command the floor refuses", () => {
    expect(
      cmd("rm -rf /", { mode, categories: { runAllCommands: true } }).policy,
    ).toBe(OFF);
  });

  it("with every switch off nothing changes", () => {
    expect(cmd("ls -la", { mode, categories: {} }).policy).toBe(ASK);
    expect(cmd("ls -la", { mode }).policy).toBe(ASK);
  });

  it("read files allows inside the workspace, asks outside it", () => {
    const on: ApprovalSettings = { mode, categories: { readFiles: true } };
    expect(
      approve("read_file", readTool, { filepath: "a.ts" }, on).policy,
    ).toBe(ALLOW);
    expect(
      approve("read_file", readTool, { filepath: "/outside/a" }, on).policy,
    ).toBe(ASK);
  });

  it("edit files and browser are separate switches", () => {
    const edit: ApprovalSettings = { mode, categories: { editFiles: true } };
    expect(
      approve("create_new_file", plain, { filepath: "a" }, edit).source,
    ).toBe("category");
    expect(
      approve("fetch_url_content", plain, { url: "https://a.b" }, edit).policy,
    ).toBe(ASK);
    const web: ApprovalSettings = { mode, categories: { browser: true } };
    expect(
      approve("fetch_url_content", plain, { url: "https://a.b" }, web).policy,
    ).toBe(ALLOW);
    expect(approve("search_web", plain, { query: "x" }, web).policy).toBe(
      ALLOW,
    );
  });

  it("a tool with no switch keeps asking", () => {
    expect(
      approve(
        "create_rule_block",
        plain,
        {},
        {
          mode,
          categories: {
            readFiles: true,
            editFiles: true,
            runAllCommands: true,
            browser: true,
            mcp: true,
          },
        },
      ).policy,
    ).toBe(ASK);
  });

  it("the Auto mode uses the same switches", () => {
    expect(
      cmd("ls -la", { mode: "auto", categories: { runSafeCommands: true } })
        .policy,
    ).toBe(ALLOW);
  });
});

describe("MCP switches", () => {
  const mode = "autoApprove" as const;
  const call = (group: string, approval: ApprovalSettings, perms?: any) =>
    approve("query", mcpTool(group), {}, approval, { permissions: perms });

  it("is off by default", () => {
    expect(call("datadog", { mode }).policy).toBe(ASK);
  });
  it("the global switch allows every server without its own", () => {
    expect(call("datadog", { mode, categories: { mcp: true } }).policy).toBe(
      ALLOW,
    );
  });
  it("a per-server switch allows just that server", () => {
    const a: ApprovalSettings = { mode, mcpServers: { datadog: true } };
    expect(call("datadog", a).source).toBe("category");
    expect(call("other", a).policy).toBe(ASK);
  });
  it("a per-server off beats the global switch", () => {
    const a: ApprovalSettings = {
      mode,
      categories: { mcp: true },
      mcpServers: { datadog: false },
    };
    expect(call("datadog", a).policy).toBe(ASK);
    expect(call("other", a).policy).toBe(ALLOW);
  });
  it("a deny rule beats the switch", () => {
    const r = call(
      "datadog",
      { mode, mcpServers: { datadog: true } },
      { deny: ["mcp__datadog__*"] },
    );
    expect(r.policy).toBe(OFF);
    expect(r.source).toBe("deny-rule");
  });
  it("an ask rule beats the switch", () => {
    const r = call(
      "datadog",
      { mode, mcpServers: { datadog: true } },
      { ask: ["mcp__datadog__query"] },
    );
    expect(r.policy).toBe(ASK);
    expect(r.source).toBe("ask-rule");
  });
});

describe("precedence: deny > protected > ask > allow > switches", () => {
  const all: ApprovalSettings = {
    mode: "autoApprove",
    categories: {
      readFiles: true,
      editFiles: true,
      runAllCommands: true,
      browser: true,
      mcp: true,
    },
  };

  it("deny rule beats a switch", () => {
    const r = cmd("npm test", all, {
      permissions: { deny: ["runTerminalCommand(npm test*)"] },
    });
    expect(r.policy).toBe(OFF);
    expect(r.source).toBe("deny-rule");
  });
  it("protected path beats a switch", () => {
    const r = cmd("cat .env", all);
    expect(r.policy).toBe(ASK);
    expect(r.source).toBe("protected-path");
  });
  it("protected file edit beats a switch", () => {
    const r = approve(
      "edit_existing_file",
      plain,
      { filepath: ".github/workflows/ci.yml" },
      all,
    );
    expect(r.policy).toBe(ASK);
    expect(r.source).toBe("protected-path");
  });
  it("ask rule beats a switch", () => {
    const r = cmd("git push", all, {
      permissions: { ask: ["runTerminalCommand(git push*)"] },
    });
    expect(r.policy).toBe(ASK);
    expect(r.source).toBe("ask-rule");
  });
  it("allow rule is reported ahead of a switch", () => {
    const r = cmd("npm test", all, {
      permissions: { allow: ["runTerminalCommand(npm test*)"] },
    });
    expect(r.source).toBe("allow-rule");
  });
  it("a tool switched off stays off", () => {
    const r = cmd("npm test", all, { basePolicy: OFF });
    expect(r.policy).toBe(OFF);
  });
});

describe("YOLO", () => {
  const yolo: ApprovalSettings = { mode: "yolo" };

  it("allows what would have asked, naming YOLO", () => {
    const r = cmd("git push origin main", yolo);
    expect(r.policy).toBe(ALLOW);
    expect(r.source).toBe("yolo");
    expect(r.reason).toMatch(/YOLO/);
  });
  it("allows tools with no switch and MCP tools", () => {
    expect(approve("create_rule_block", plain, {}, yolo).policy).toBe(ALLOW);
    expect(approve("query", mcpTool("x"), {}, yolo).policy).toBe(ALLOW);
  });
  it("still allows a file outside the workspace (it is the point of YOLO)", () => {
    expect(
      approve("read_file", readTool, { filepath: "/outside/a" }, yolo).policy,
    ).toBe(ALLOW);
  });
  it("overrides the safety floor, deny rules, protected paths and ask rules", () => {
    expect(cmd("rm -rf /", yolo).policy).toBe(ALLOW);
    const deny = {
      permissions: { deny: ["runTerminalCommand(terraform apply*)"] },
    };
    expect(cmd("terraform apply", yolo, deny).policy).toBe(ALLOW);
    expect(cmd("cat .env", yolo).policy).toBe(ALLOW);
    const ask = { permissions: { ask: ["runTerminalCommand(git push*)"] } };
    expect(cmd("git push", yolo, ask).policy).toBe(ALLOW);
  });
  it("does not turn on a tool the user switched off", () => {
    expect(cmd("npm test", yolo, { basePolicy: OFF }).policy).toBe(OFF);
  });
});

describe("Review", () => {
  const review: ApprovalSettings = { mode: "review" };

  it("allows what would have asked, naming the mode", () => {
    const r = cmd("git push origin main", review);
    expect(r.policy).toBe(ALLOW);
    expect(r.source).toBe("review");
  });
  it("still refuses what the safety floor refuses", () => {
    const r = cmd("rm -rf /", review);
    expect(r.policy).toBe(OFF);
    expect(r.source).not.toBe("review");
  });
  it("still honours deny rules", () => {
    const r = cmd("terraform apply", review, {
      permissions: { deny: ["runTerminalCommand(terraform apply*)"] },
    });
    expect(r.policy).toBe(OFF);
    expect(r.source).toBe("deny-rule");
  });
  it("still honours protected paths for commands and files", () => {
    expect(cmd("cat ~/.aws/credentials", review).source).toBe("protected-path");
    expect(cmd("cat .env", review).policy).toBe(ASK);
    const e = approve(
      "edit_existing_file",
      plain,
      { filepath: ".git/hooks/pre-commit" },
      review,
    );
    expect(e.policy).toBe(ASK);
    expect(e.source).toBe("protected-path");
  });
  it("still honours ask rules", () => {
    const r = cmd("git push", review, {
      permissions: { ask: ["runTerminalCommand(git push*)"] },
    });
    expect(r.policy).toBe(ASK);
    expect(r.source).toBe("ask-rule");
  });
});
