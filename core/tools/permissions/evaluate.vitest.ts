import { describe, expect, it } from "vitest";
import { evaluateToolPolicyWithRules } from "./evaluate";
import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";

const ASK = "allowedWithPermission" as const;
const ALLOW = "allowedWithoutPermission" as const;
const OFF = "disabled" as const;

/** A terminal tool wired the way the real one is: its own safety check. */
const terminalTool = {
  group: "Built-In",
  evaluateToolCallPolicy: (base: any, args: Record<string, unknown>) =>
    evaluateTerminalCommandSecurity(base, args.command as string),
};

const run = (command: string, permissions?: any, basePolicy: any = ASK) =>
  evaluateToolPolicyWithRules({
    tool: terminalTool as any,
    toolName: "run_terminal_command",
    basePolicy,
    parsedArgs: { command },
    permissions,
  });

describe("without rules: behaviour is what it was before", () => {
  it("returns the tool's own policy and the command for display", () => {
    // The safety check only ever tightens the base policy, so a safe command
    // keeps an "allow" base and an "ask" base stays "ask".
    expect(run("ls", undefined, ALLOW)).toEqual({
      policy: ALLOW,
      displayValue: "ls",
    });
    expect(run("ls")).toEqual({ policy: ASK, displayValue: "ls" });
    expect(run("npm install left-pad", undefined, ALLOW).policy).toBe(ASK);
  });

  it("adds no source, reason or rule", () => {
    const r = run("ls");
    expect(r).not.toHaveProperty("source");
    expect(r).not.toHaveProperty("reason");
    expect(r).not.toHaveProperty("rule");
  });

  it("empty permissions behave like none", () => {
    expect(run("ls", {})).toEqual(run("ls"));
    expect(run("ls", { allow: [], deny: [] })).toEqual(run("ls"));
  });

  it("an unknown tool keeps its base policy", () => {
    expect(
      evaluateToolPolicyWithRules({
        tool: undefined,
        toolName: "nope",
        basePolicy: ASK,
        parsedArgs: {},
        permissions: { deny: ["nope"] },
      }),
    ).toEqual({ policy: ASK });
  });

  it("a tool without its own check uses the base policy", () => {
    expect(
      evaluateToolPolicyWithRules({
        tool: { group: "Built-In" } as any,
        toolName: "fetch_url_content",
        basePolicy: ASK,
        parsedArgs: { url: "https://x" },
        permissions: undefined,
      }),
    ).toEqual({ policy: ASK, displayValue: undefined });
  });
});

describe("with rules", () => {
  it("an allow rule lets an npm test through without asking, and says so", () => {
    const r = run("npm test", { allow: ["runTerminalCommand(npm test*)"] });
    expect(r).toMatchObject({
      policy: ALLOW,
      source: "allow-rule",
      rule: "runTerminalCommand(npm test*)",
      displayValue: "npm test",
    });
  });

  it("a deny rule refuses a command the safety floor would allow", () => {
    const r = run("cat .env", { deny: ["runTerminalCommand(cat *.env*)"] });
    expect(r.policy).toBe(OFF);
    expect(r.source).toBe("deny-rule");
    expect(r.displayValue).toBe("cat .env");
  });

  it("the safety floor still refuses what an allow rule would permit", () => {
    const r = run("rm -rf /", { allow: ["runTerminalCommand(rm*)"] });
    expect(r.policy).toBe(OFF);
    expect(r.source).toBe("safety-floor");
  });

  it("an allow rule cannot ride on a chained destructive tail", () => {
    const r = run("npm test; rm -rf /", {
      allow: ["runTerminalCommand(npm test*)"],
    });
    expect(r.policy).toBe(OFF);
  });

  it("an ask rule stops an otherwise allowed command", () => {
    const r = run("git status", { ask: ["runTerminalCommand(git*)"] }, ALLOW);
    expect(r).toMatchObject({ policy: ASK, source: "ask-rule" });
  });
});

describe("file tools", () => {
  const readTool = {
    group: "Built-In",
    evaluateToolCallPolicy: (base: any) => base,
  };
  const read = (filepath: string, permissions: any, resolvedUri?: string) =>
    evaluateToolPolicyWithRules({
      tool: readTool as any,
      toolName: "read_file",
      basePolicy: ALLOW,
      parsedArgs: { filepath },
      processedArgs: resolvedUri
        ? { resolvedPath: { uri: resolvedUri, isWithinWorkspace: true } }
        : undefined,
      permissions,
    });

  it("refuses .env by the path the model wrote", () => {
    expect(read(".env", { deny: ["readFile(**/.env)"] }).policy).toBe(OFF);
  });

  it("refuses .env by its resolved file URI", () => {
    const r = read(
      "secrets",
      { deny: ["readFile(**/.env)"] },
      "file:///home/me/proj/secrets/.env",
    );
    expect(r.policy).toBe(OFF);
  });

  it("a Windows file URI resolves to a rule-matchable path", () => {
    const r = read(
      "x",
      { deny: ["readFile(**/.env)"] },
      "file:///C:/proj/app/.env",
    );
    expect(r.policy).toBe(OFF);
  });
});

describe("MCP tools", () => {
  const mcpTool = {
    group: "Datadog",
    uri: "mcp://abc/query_metrics",
    originalFunctionName: "query_metrics",
  };
  const call = (permissions: any, basePolicy: any = ASK) =>
    evaluateToolPolicyWithRules({
      tool: mcpTool as any,
      toolName: "datadog_query_metrics",
      basePolicy,
      parsedArgs: {},
      permissions,
    });

  it("an allow rule for the server lets its tools through", () => {
    expect(call({ allow: ["mcp__datadog__*"] })).toMatchObject({
      policy: ALLOW,
      source: "allow-rule",
    });
  });

  it("a deny for one tool wins over the server allow", () => {
    expect(
      call({
        allow: ["mcp__datadog__*"],
        deny: ["mcp__datadog__query_metrics"],
      }).policy,
    ).toBe(OFF);
  });

  it("does not match another server", () => {
    expect(call({ allow: ["mcp__wiz__*"] }).policy).toBe(ASK);
  });
});
