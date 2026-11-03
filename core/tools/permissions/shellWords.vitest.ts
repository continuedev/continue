import { describe, expect, it } from "vitest";
import { commandCandidates } from "./candidates";
import { hasUnsafeShellConstruct } from "./command";
import {
  commandName,
  dequote,
  extractSubstitutions,
  splitRawWords,
  stripGrouping,
} from "./shellWords";

describe("dequote", () => {
  it.each([
    ["git", "git"],
    ["'push'", "push"],
    ['"push"', "push"],
    ['gi""t', "git"],
    ["g\\it", "git"],
    ["$'git'", "git"],
    ["$'\\x67it'", "git"],
    ["$'\\147it'", "git"],
    ["$'\\u0067it'", "git"],
    ['$"git"', "git"],
    ["'a b'", "a b"],
    ['"a\\"b"', 'a"b'],
    ["a'b'c", "abc"],
  ])("%s -> %s", (raw, expected) => {
    expect(dequote(raw)).toBe(expected);
  });

  it("keeps an unterminated quote's text instead of throwing", () => {
    expect(dequote("'abc")).toBe("abc");
    expect(dequote('"abc')).toBe("abc");
    expect(dequote("$'abc")).toBe("abc");
  });
});

describe("splitRawWords", () => {
  it("splits on whitespace outside quotes only", () => {
    expect(splitRawWords("git commit -m 'a b' \"c d\" e\\ f")).toEqual([
      "git",
      "commit",
      "-m",
      "'a b'",
      '"c d"',
      "e\\ f",
    ]);
  });
});

describe("commandName", () => {
  it.each([
    ["git", "git"],
    ["GIT", "git"],
    ["/usr/bin/git", "git"],
    ["git.exe", "git"],
    ["C:\\Program Files\\Git\\bin\\Git.EXE", "git"],
    ["(git", "git"],
    ["{", ""],
    ["./run.sh", "run.sh"],
  ])("%s -> %s", (word, expected) => {
    expect(commandName(word)).toBe(expected);
  });
});

describe("stripGrouping and extractSubstitutions", () => {
  it("strips openers and closers", () => {
    expect(stripGrouping("(git")).toBe("git");
    expect(stripGrouping("push)")).toBe("push");
    expect(stripGrouping("$(git")).toBe("git");
  });
  it("finds nested and backtick substitutions", () => {
    expect(extractSubstitutions("echo $(a $(b)) `c`")).toEqual([
      "a $(b)",
      "b",
      "c",
    ]);
  });
  it("does not run past an unterminated substitution", () => {
    expect(extractSubstitutions("echo $(a")).toEqual(["a"]);
  });
});

describe("commandCandidates", () => {
  const has = (cmd: string, want: string) =>
    expect(commandCandidates(cmd)).toContain(want);

  it("reads the command the way the shell does", () => {
    has("git 'push' origin", "git push origin");
    has("/usr/bin/git push", "git push");
    has("git -C . -c a=b push", "git push");
    has("env -i FOO=1 git push", "git push");
    has("timeout 30 git push", "git push");
    has("X=push; git $X origin", "git push origin");
  });
  it("opens nested scripts", () => {
    has("bash -c 'git push'", "git push");
    has('powershell -Command "git push"', "git push");
    has("cmd /c git push", "git push");
    has("eval 'git push'", "git push");
    has("python -c \"import os; os.system('git push')\"", "git push");
    has("echo $(git push)", "git push");
    has("echo push | xargs git", "git push");
    has("echo 'git push' | sh", "git push");
  });
  it("is bounded: a deeply nested command does not blow up", () => {
    let c = "git push";
    for (let i = 0; i < 12; i++) c = `bash -c '${c.replace(/'/g, "'\\''")}'`;
    const t = Date.now();
    expect(commandCandidates(c).length).toBeLessThan(2000);
    expect(Date.now() - t).toBeLessThan(2000);
  });
  it("does not invent a git push out of a longer word", () => {
    expect(commandCandidates("git pushover")).not.toContain("git push");
    expect(commandCandidates("echo git push")).not.toContain("git push origin");
  });
});

describe("hasUnsafeShellConstruct", () => {
  it.each([
    "echo $(id)",
    "echo `id`",
    "echo <(id)",
    "echo ${x@P}",
    "echo ${x:=y}",
    "echo ${x:-$(id)}",
    "echo ${!x}",
    "echo ${x/a/b}",
    "rg$IFS--pre=sh",
    "echo ${IFS}",
  ])("%s is unsafe", (c) => expect(hasUnsafeShellConstruct(c)).toBe(true));

  it.each(["echo $HOME", "echo ${HOME}", "echo ${HOME}/bin"])(
    "%s is fine",
    (c) => expect(hasUnsafeShellConstruct(c)).toBe(false),
  );
});
