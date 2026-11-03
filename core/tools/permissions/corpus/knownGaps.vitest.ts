import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import { describe, expect, it } from "vitest";
import { evaluateToolPolicyWithRules } from "../evaluate";

/**
 * What a text-matching deny rule CANNOT see. Each case asserts the command runs
 * (is NOT refused) so the gap is on record; when one is fixed this test fails,
 * which is the cue to move the case into corpus.vitest.ts. Vendors say the same
 * of their own rules ("a Bash rule is not a security boundary"); for a hard
 * guarantee use a sandbox or a deny rule on the interpreter itself.
 */
const DENY = { deny: ["runTerminalCommand(git push*)"] };
const terminalTool = {
  group: "Built-In",
  evaluateToolCallPolicy: (base: any, args: Record<string, unknown>) =>
    evaluateTerminalCommandSecurity(base, args.command as string),
};
const refused = (command: string) =>
  evaluateToolPolicyWithRules({
    tool: terminalTool as any,
    toolName: "run_terminal_command",
    basePolicy: "allowedWithoutPermission",
    parsedArgs: { command },
    permissions: DENY,
  }).policy === "disabled";

const KNOWN_GAPS: [string, string][] = [
  ["base64 into a shell", "echo Z2l0IHB1c2g= | base64 -d | sh"],
  ["hex via printf into a shell", "printf '\\x67it push' | sh"],
  ["a script file", "sh ./push.sh"],
  ["an alias", "alias gp='git push'; gp"],
  ["a glob in the name", "/usr/bin/gi? push"],
  ["git alias configured earlier", "git config alias.p push && git p"],
  ["another tool that pushes", "gh repo sync --force"],
  ["a wrapper script", "make publish"],
];

describe("known gaps: a deny rule on git push does not see these", () => {
  it.each(KNOWN_GAPS)("%s", (_label, command) => {
    expect(refused(command)).toBe(false);
  });
});
