import { describe, expect, it } from "vitest";
import { commandGlobMatch, parseCommand, ruleCandidates } from "./command";

describe("parseCommand", () => {
  it("splits on unquoted separators and collapses spaces", () => {
    expect(
      parseCommand("npm  test && npm run lint; echo ok | cat\nls").parts,
    ).toEqual(["npm test", "npm run lint", "echo ok", "cat", "ls"]);
  });

  it("does not split inside quotes", () => {
    expect(parseCommand('echo "a && b; c | d"').parts).toEqual([
      'echo "a && b; c | d"',
    ]);
    expect(parseCommand("echo 'x;y'").parts).toEqual(["echo 'x;y'"]);
  });

  it("treats a single & as a separator, so a background tail is its own part", () => {
    expect(parseCommand("npm test & rm -rf node_modules").parts).toEqual([
      "npm test",
      "rm -rf node_modules",
    ]);
  });

  it("does not split 2>&1 and flags a real redirect", () => {
    const dup = parseCommand("npm test 2>&1");
    expect(dup.parts).toEqual(["npm test 2>&1"]);
    expect(dup.hasFileRedirect).toBe(false);
    expect(parseCommand("npm test > out.txt").hasFileRedirect).toBe(true);
    expect(parseCommand("cat < in.txt").hasFileRedirect).toBe(true);
    expect(parseCommand("npm test &> out.txt").hasFileRedirect).toBe(true);
  });

  it("ignores > inside quotes", () => {
    expect(parseCommand('echo "a > b"').hasFileRedirect).toBe(false);
  });

  it("flags an unterminated quote and a trailing backslash", () => {
    expect(parseCommand('echo "oops').unparsable).toBe(true);
    expect(parseCommand("echo oops\\").unparsable).toBe(true);
    expect(parseCommand("echo fine").unparsable).toBe(false);
  });

  it("joins a backslash-newline continuation", () => {
    expect(parseCommand("npm \\\ntest").parts).toEqual(["npm test"]);
  });
});

describe("commandGlobMatch", () => {
  it("lets * cross slashes, unlike a path glob", () => {
    expect(
      commandGlobMatch(
        "terraform apply*",
        "terraform apply -var-file=a/b.tfvars",
      ),
    ).toBe(true);
    expect(commandGlobMatch("git push*", "git push origin feature/x")).toBe(
      true,
    );
  });

  it("escapes regex metacharacters", () => {
    expect(commandGlobMatch("a.b (x)", "a.b (x)")).toBe(true);
    expect(commandGlobMatch("a.b", "axb")).toBe(false);
  });
});

describe("ruleCandidates", () => {
  it("includes word-suffixes so a prefix command does not hide the real one", () => {
    expect(ruleCandidates("sudo git push origin main")).toContain(
      "git push origin main",
    );
    expect(ruleCandidates("env FOO=1 git push")).toContain("git push");
  });

  it("includes the script inside bash -c", () => {
    expect(ruleCandidates("bash -c 'git push origin main'")).toContain(
      "git push origin main",
    );
    expect(ruleCandidates('sh -c "npm test && git push"')).toContain(
      "git push",
    );
    expect(ruleCandidates("/bin/bash -lc 'git push'")).toContain("git push");
  });
});
