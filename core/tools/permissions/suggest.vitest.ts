import { describe, expect, it } from "vitest";
import { decideToolCall } from "./decide";
import { parseRule } from "./rules";
import { suggestAllowRule } from "./suggest";

const ASK = "allowedWithPermission" as const;
const ALLOW = "allowedWithoutPermission" as const;

/** Does an allow rule written for `shown` also allow `other`? */
function allows(
  rule: string,
  call: { toolName: string; parsedArgs: Record<string, unknown> },
  mcp?: { serverName: string; toolName: string },
) {
  const parsed = parseRule(rule, "allow");
  expect(parsed, `rule must parse: ${rule}`).toBeDefined();
  return (
    decideToolCall({
      ...call,
      mcp,
      base: ASK,
      evaluated: ASK,
      rules: [parsed!],
    }).policy === ALLOW
  );
}

const term = (command: string) => ({
  toolName: "run_terminal_command",
  parsedArgs: { command },
});
const read = (filepath: string) => ({
  toolName: "read_file",
  parsedArgs: { filepath },
});

describe("suggestAllowRule: terminal", () => {
  it("writes the exact command, and the rule allows that command", () => {
    const s = suggestAllowRule(term("npm test"));
    expect(s).toMatchObject({ ok: true, rule: "runTerminalCommand(npm test)" });
    expect(allows((s as any).rule, term("npm test"))).toBe(true);
  });

  it("does not allow a longer command that merely starts the same", () => {
    const { rule } = suggestAllowRule(term("npm test")) as any;
    expect(allows(rule, term("npm test; rm -rf /"))).toBe(false);
    expect(allows(rule, term("npm test --force"))).toBe(false);
    expect(allows(rule, term("npm testing"))).toBe(false);
    expect(allows(rule, term("sudo npm test"))).toBe(false);
    expect(allows(rule, term("npm test > out.txt"))).toBe(false);
  });

  it("refuses a chained command, because allow rules are matched per part", () => {
    const s = suggestAllowRule(term("cd src && npm test"));
    expect(s.ok).toBe(false);
    expect((s as any).reason).toMatch(/one at a time/);
    // A single command whose quoted text contains a separator is fine.
    const q = suggestAllowRule(term('echo "a && b"'));
    expect(q.ok).toBe(true);
    expect(allows((q as any).rule, term('echo "a && b"'))).toBe(true);
  });

  it.each([
    ["a file redirect", "npm test > out.txt"],
    ["command substitution", "echo $(whoami)"],
    ["backticks", "echo `whoami`"],
    ["an unterminated quote", 'echo "oops'],
    ["a wildcard", "rm *.log"],
    ["a question mark", "ls file?.txt"],
    ["a closing paren", "echo (hi)"],
    ["a newline", "echo a\necho b"],
    ["nothing", "   "],
  ])("refuses to write a rule for %s", (_label, command) => {
    const s = suggestAllowRule(term(command));
    expect(s.ok).toBe(false);
    expect((s as any).reason).toBeTruthy();
  });

  it("trims the command it saves", () => {
    const s = suggestAllowRule(term("  ls  "));
    expect((s as any).rule).toBe("runTerminalCommand(ls)");
  });
});

describe("suggestAllowRule: files", () => {
  it("writes the one path", () => {
    const s = suggestAllowRule(read("./src/app.ts"));
    expect(s).toMatchObject({ ok: true, rule: "readFile(src/app.ts)" });
    expect(allows((s as any).rule, read("src/app.ts"))).toBe(true);
    expect(allows((s as any).rule, read("src/other.ts"))).toBe(false);
    expect(allows((s as any).rule, read("src/app.ts.bak"))).toBe(false);
  });

  it("normalises Windows separators", () => {
    expect((suggestAllowRule(read("src\\a\\b.ts")) as any).rule).toBe(
      "readFile(src/a/b.ts)",
    );
  });

  it.each([
    ["a path that leaves the project", "../secrets.txt"],
    ["an absolute path", "/etc/passwd"],
    ["a drive path", "C:/Users/me/x.txt"],
    ["a wildcard", "src/*.ts"],
    ["a paren", "src/a(1).ts"],
  ])("refuses %s", (_l, p) => {
    expect(suggestAllowRule(read(p)).ok).toBe(false);
  });

  it("covers listing a directory", () => {
    expect(
      suggestAllowRule({ toolName: "ls", parsedArgs: { dirPath: "src" } }),
    ).toMatchObject({ ok: true, rule: "listDirectory(src)" });
  });

  it("never offers an always-allow for edits", () => {
    for (const toolName of [
      "create_new_file",
      "edit_existing_file",
      "multi_edit",
    ]) {
      expect(
        suggestAllowRule({ toolName, parsedArgs: { filepath: "a.ts" } }).ok,
      ).toBe(false);
    }
  });
});

describe("suggestAllowRule: protected paths", () => {
  it.each([
    ["a secret read", read(".env")],
    [
      "a home secret directory",
      { toolName: "ls", parsedArgs: { dirPath: "~/.ssh" } },
    ],
    ["a command that touches a secret", term("cat ~/.aws/credentials")],
    ["a command that touches .env", term("cat .env")],
  ])("offers no rule for %s, because it always asks", (_l, call) => {
    const s = suggestAllowRule(call as any);
    expect(s.ok).toBe(false);
    expect((s as any).reason).toMatch(/protected path/);
  });

  it("still offers a rule for a look-alike that is not protected", () => {
    expect(suggestAllowRule(read(".env.example")).ok).toBe(true);
    expect(suggestAllowRule(term("cat README.md")).ok).toBe(true);
  });
});

describe("suggestAllowRule: MCP and others", () => {
  const mcp = { serverName: "Datadog", toolName: "query_metrics" };

  it("allows the one MCP tool, never the whole server", () => {
    const s = suggestAllowRule({ toolName: "x", parsedArgs: {}, mcp });
    expect(s).toMatchObject({ ok: true, rule: "mcp__datadog__query_metrics" });
    expect(
      allows((s as any).rule, { toolName: "x", parsedArgs: {} }, mcp),
    ).toBe(true);
    expect(
      allows(
        (s as any).rule,
        { toolName: "y", parsedArgs: {} },
        { serverName: "Datadog", toolName: "delete_monitor" },
      ),
    ).toBe(false);
  });

  it("does not offer a rule for URLs, unknown tools or non-read-only search", () => {
    expect(
      suggestAllowRule({
        toolName: "fetch_url_content",
        parsedArgs: { url: "https://x" },
      }).ok,
    ).toBe(false);
    expect(suggestAllowRule({ toolName: "mystery", parsedArgs: {} }).ok).toBe(
      false,
    );
    expect(
      suggestAllowRule({ toolName: "grep_search", parsedArgs: { query: "x" } })
        .ok,
    ).toBe(false);
  });

  it("allows a read-only search tool by name", () => {
    expect(
      suggestAllowRule({
        toolName: "grep_search",
        parsedArgs: { query: "x" },
        readonly: true,
      }),
    ).toMatchObject({ ok: true, rule: "grepSearch" });
  });
});
