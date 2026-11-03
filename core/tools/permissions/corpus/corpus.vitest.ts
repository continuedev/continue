import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import { describe, expect, it } from "vitest";
import { evaluateToolPolicyWithRules } from "../evaluate";
import { findProtected, protectedCommandHit } from "../protectedCall";
import { GIT_PUSH_VARIANTS } from "./denyVariants";
import {
  ALLOW_PAYLOADS,
  CONFIG_WRITES,
  SECRET_COMMANDS,
  SECRET_READS,
} from "./payloads";

const HOME = "C:\\Users\\me";
const OPEN = "allowedWithoutPermission" as const;
const ASK = "allowedWithPermission" as const;

const terminalTool = {
  group: "Built-In",
  evaluateToolCallPolicy: (base: any, args: Record<string, unknown>) =>
    evaluateTerminalCommandSecurity(base, args.command as string),
};

const run = (command: string, permissions: any, basePolicy: any) =>
  evaluateToolPolicyWithRules({
    tool: terminalTool as any,
    toolName: "run_terminal_command",
    basePolicy,
    parsedArgs: { command },
    permissions,
  });

describe("deny rule git push* refuses every way of spelling git push", () => {
  const DENY = { deny: ["runTerminalCommand(git push*)"] };
  it.each(GIT_PUSH_VARIANTS)("%s", (_label, command) => {
    expect(run(command, DENY, OPEN).policy).toBe("disabled");
  });
});

describe("the same spellings of a command the safety check allows are still refused", () => {
  // `git status` runs silently by default, so a miss here is a silent run.
  const DENY = { deny: ["runTerminalCommand(git status*)"] };
  const swap = (c: string) =>
    c.replace(/push/g, "status").replace("pu\\sh", "stat\\us");
  it.each(GIT_PUSH_VARIANTS)("%s", (_label, command) => {
    expect(run(swap(command), DENY, OPEN).policy).toBe("disabled");
  });
});

describe("an allow rule is never applied to a command it cannot fully see", () => {
  it.each(ALLOW_PAYLOADS)("%s", (_label, command, permissions, mustNot) => {
    const ruleAllowed = run(command, permissions, ASK).source === "allow-rule";
    expect(ruleAllowed).toBe(!mustNot);
  });
});

describe("credentials are protected for reads", () => {
  it.each(SECRET_READS)("%s", (path, secret) => {
    const hit = findProtected({
      toolName: "read_file",
      parsedArgs: { filepath: path },
      home: HOME,
    });
    expect(hit?.kind === "secret").toBe(secret);
  });
});

describe("files that change what runs later ask before a write", () => {
  it.each(CONFIG_WRITES)("%s", (path, protectedWrite) => {
    const hit = findProtected({
      toolName: "create_new_file",
      parsedArgs: { filepath: path },
      home: HOME,
    });
    expect(hit !== undefined).toBe(protectedWrite);
  });
});

describe("commands that print or send credentials are marked protected", () => {
  // `protectedCommandHit` alone: the safety check asks about many of these (and
  // about `npm test`) for its own reasons, which must not hide a missing mark.
  it.each(SECRET_COMMANDS)("%s", (command, mustAsk) => {
    expect(protectedCommandHit(command, HOME) !== undefined).toBe(mustAsk);
  });
});
