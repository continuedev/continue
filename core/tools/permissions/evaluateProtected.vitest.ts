import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import { describe, expect, it } from "vitest";
import { evaluateToolPolicyWithRules } from "./evaluate";

const ASK = "allowedWithPermission" as const;
const ALLOW = "allowedWithoutPermission" as const;
const OFF = "disabled" as const;

const terminalTool = {
  group: "Built-In",
  evaluateToolCallPolicy: (base: any, args: Record<string, unknown>) =>
    evaluateTerminalCommandSecurity(base, args.command as string),
};
const fileTool = {
  group: "Built-In",
  evaluateToolCallPolicy: (base: any) => base,
};

const run = (command: string, permissions?: any, base: any = ALLOW) =>
  evaluateToolPolicyWithRules({
    tool: terminalTool as any,
    toolName: "run_terminal_command",
    basePolicy: base,
    parsedArgs: { command },
    permissions,
  });

const read = (filepath: string, permissions?: any, resolvedUri?: string) =>
  evaluateToolPolicyWithRules({
    tool: fileTool as any,
    toolName: "read_file",
    basePolicy: ALLOW,
    parsedArgs: { filepath },
    processedArgs: resolvedUri
      ? { resolvedPath: { uri: resolvedUri, isWithinWorkspace: true } }
      : undefined,
    permissions,
  });

describe("protected paths work with no rules at all", () => {
  it("reading .env asks, even though reads normally run without asking", () => {
    const r = read(".env");
    expect(r).toMatchObject({ policy: ASK, source: "protected-path" });
    expect(r.reason).toMatch(/\.env.*credentials/);
  });

  it("an ordinary file is untouched, and carries no extra fields", () => {
    expect(read("src/a.ts")).toEqual({
      policy: ALLOW,
      displayValue: undefined,
    });
  });

  it("cat .env asks (the safety check alone allows it)", () => {
    expect(evaluateTerminalCommandSecurity(ALLOW, "cat .env")).toBe(ALLOW);
    const r = run("cat .env");
    expect(r).toMatchObject({
      policy: ASK,
      source: "protected-path",
      displayValue: "cat .env",
    });
  });

  it("cat ~/.aws/credentials asks", () => {
    expect(run("cat ~/.aws/credentials").policy).toBe(ASK);
  });

  it("the resolved path is checked too, so a link name does not hide a secret", () => {
    const r = read("notes.txt", undefined, "file:///home/me/proj/.env");
    expect(r.policy).toBe(ASK);
  });

  it("an ordinary command is untouched", () => {
    expect(run("ls")).toEqual({ policy: ALLOW, displayValue: "ls" });
  });
});

describe("protected paths and rules", () => {
  it("an allow rule cannot loosen a protected path", () => {
    const r = read(".env", { allow: ["readFile(**)"] });
    expect(r).toMatchObject({ policy: ASK, source: "protected-path" });
    expect(
      run("cat .env", { allow: ["runTerminalCommand(cat*)"] }).policy,
    ).toBe(ASK);
  });

  it("a deny rule still refuses, and names the rule", () => {
    const r = read(".env", { deny: ["readFile(**/.env)"] });
    expect(r).toMatchObject({ policy: OFF, source: "deny-rule" });
  });

  it("an ask rule on a protected path reads as the protected-path reason", () => {
    const r = read(".env", { ask: ["readFile(**/.env)"] });
    expect(r.policy).toBe(ASK);
  });

  it("does not undo a refusal: the safety floor stays disabled", () => {
    // `rm -rf /` is refused outright by the safety check (probed: disabled).
    // An allow rule is present so the decision engine runs and names the source.
    const r = run("rm -rf /", { allow: ["runTerminalCommand(rm*)"] }, ASK);
    expect(r.policy).toBe(OFF);
    expect(r.source).toBe("safety-floor");
  });

  it("a refused command that also touches a secret stays refused, not downgraded to ask", () => {
    const r = run("rm -rf / && cat ~/.aws/credentials", undefined, ASK);
    expect(r.policy).toBe(OFF);
  });

  it("a command that is only risky (ask) and touches a secret asks, with the protected reason", () => {
    // `rm -rf ~/.aws` is "ask" in the safety check (probed), and touches ~/.aws.
    const r = run("rm -rf ~/.aws", undefined, ASK);
    expect(r).toMatchObject({ policy: ASK, source: "protected-path" });
  });

  it("a tool the user switched off stays off", () => {
    const r = evaluateToolPolicyWithRules({
      tool: fileTool as any,
      toolName: "read_file",
      basePolicy: OFF,
      parsedArgs: { filepath: ".env" },
      permissions: undefined,
    });
    expect(r.policy).toBe(OFF);
  });

  it("an edit to a workflow file is flagged so the core can refuse or ask", () => {
    const r = evaluateToolPolicyWithRules({
      tool: fileTool as any,
      toolName: "edit_existing_file",
      basePolicy: ALLOW,
      parsedArgs: { filepath: ".github/workflows/ci.yml" },
      permissions: undefined,
    });
    expect(r).toMatchObject({ policy: ASK, source: "protected-path" });
  });
});
