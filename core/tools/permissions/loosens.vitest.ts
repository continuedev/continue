import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import { describe, expect, it } from "vitest";
import { suggestAllowRule, withLoosensCheck } from "./suggest";

/** A terminal tool wired the way the real one is. */
const terminalTool = {
  evaluateToolCallPolicy: (base: any, args: Record<string, unknown>) =>
    evaluateTerminalCommandSecurity(base, args.command as string),
};

const flag = (command: string) => {
  const args = { command };
  const s = withLoosensCheck(
    suggestAllowRule({ toolName: "run_terminal_command", parsedArgs: args }),
    terminalTool,
    args,
  );
  return s.ok ? s.loosensCheck : "no-rule";
};

describe("withLoosensCheck: commands the safety check still asks about", () => {
  // Probed against the real check: these ask even when the tool is set to allow.
  it.each([
    "npm test",
    "npm install left-pad",
    "curl https://example.com",
    "git push origin main",
    "docker run x",
    "python script.py",
    "node app.js",
    "kubectl get pods",
    "aws s3 ls",
    "terraform plan",
    "pip install requests",
  ])("flags %s", (c) => {
    expect(flag(c)).toBe(true);
  });

  // Probed: the check already lets these through, so a rule changes nothing.
  it.each(["git status", "ls -la", "make build", "npm run build"])(
    "does not flag %s",
    (c) => {
      expect(flag(c)).toBe(false);
    },
  );
});

describe("withLoosensCheck: other cases", () => {
  const ok = { ok: true as const, rule: "r", summary: "s" };

  it("leaves a refusal untouched", () => {
    const no = { ok: false as const, reason: "nope" };
    expect(withLoosensCheck(no, terminalTool, {})).toBe(no);
  });

  it("is false for a tool with no check of its own", () => {
    expect(withLoosensCheck(ok, {}, {})).toMatchObject({ loosensCheck: false });
    expect(withLoosensCheck(ok, undefined, {})).toMatchObject({
      loosensCheck: false,
    });
  });

  it("assumes the check would ask if the check itself throws (the safe side)", () => {
    const broken = {
      evaluateToolCallPolicy: () => {
        throw new Error("boom");
      },
    };
    expect(withLoosensCheck(ok, broken, {})).toMatchObject({
      loosensCheck: true,
    });
  });

  it("keeps the rule and summary it was given", () => {
    expect(withLoosensCheck(ok, {}, {})).toMatchObject({
      ok: true,
      rule: "r",
      summary: "s",
    });
  });
});
