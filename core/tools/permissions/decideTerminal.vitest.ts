import { describe, expect, it } from "vitest";
import { ALLOW, ASK, decide, OFF, term } from "./decideTestUtils";

describe("decideToolCall: terminal", () => {
  it("an allow rule turns ask into allow and says why", () => {
    const d = decide(
      { allow: ["runTerminalCommand(npm test*)"] },
      term("npm test"),
    );
    expect(d).toMatchObject({
      policy: ALLOW,
      source: "allow-rule",
      rule: "runTerminalCommand(npm test*)",
    });
    expect(d.reason).toContain("runTerminalCommand(npm test*)");
  });

  it("a deny rule refuses and names the rule", () => {
    const d = decide(
      { deny: ["runTerminalCommand(terraform apply*)"] },
      term("terraform apply"),
    );
    expect(d.policy).toBe(OFF);
    expect(d.source).toBe("deny-rule");
    expect(d.reason).toMatch(
      /Blocked by your rule runTerminalCommand\(terraform apply\*\)/,
    );
  });

  it("deny refuses even when the tool is allowed without permission", () => {
    const d = decide(
      { deny: ["runTerminalCommand(rm -rf*)"] },
      { ...term("rm -rf /tmp/x"), base: ALLOW, evaluated: ALLOW },
    );
    expect(d.policy).toBe(OFF);
  });

  it("an ask rule makes an allowed call ask", () => {
    const d = decide(
      { ask: ["runTerminalCommand(git push*)"] },
      { ...term("git push"), base: ALLOW, evaluated: ALLOW },
    );
    expect(d).toMatchObject({ policy: ASK, source: "ask-rule" });
  });

  it("the safety floor's refusal cannot be loosened by an allow rule", () => {
    const d = decide(
      { allow: ["runTerminalCommand(rm*)"] },
      { ...term("rm -rf /"), base: ASK, evaluated: OFF },
    );
    expect(d).toMatchObject({ policy: OFF, source: "safety-floor" });
  });

  it("a tool switched off stays off despite an allow rule", () => {
    const d = decide(
      { allow: ["runTerminalCommand"] },
      { ...term("ls"), base: OFF, evaluated: OFF },
    );
    expect(d).toMatchObject({ policy: OFF, source: "tool-setting" });
  });

  it("an allow rule loosens a safety-floor ask, because the user chose it", () => {
    const d = decide(
      { allow: ["runTerminalCommand(curl https://api.internal/*)"] },
      { ...term("curl https://api.internal/health"), evaluated: ASK },
    );
    expect(d.policy).toBe(ALLOW);
  });

  it("with no matching rule the evaluated policy stands", () => {
    const d = decide({ allow: ["runTerminalCommand(npm test*)"] }, term("ls"));
    expect(d.policy).toBe(ASK);
    expect(d.source).toBe("tool-setting");
    expect(decide({}, { ...term("ls"), evaluated: ALLOW }).source).toBe(
      "default",
    );
  });

  it("denies a sudo or bash -c wrapped command", () => {
    const perms = { deny: ["runTerminalCommand(git push*)"] };
    expect(decide(perms, term("sudo git push")).policy).toBe(OFF);
    expect(decide(perms, term("bash -c 'git push'")).policy).toBe(OFF);
  });
});
