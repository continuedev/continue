import { describe, expect, it } from "vitest";
import {
  canonicalRuleName,
  mcpRuleName,
  normalizeRelative,
  ruleTargetsFor,
  uriToPath,
  validateToolPermissions,
} from "./names";

describe("validateToolPermissions", () => {
  it("is silent for good rules and for no rules", () => {
    expect(validateToolPermissions(undefined)).toEqual([]);
    expect(
      validateToolPermissions({
        allow: [
          "runTerminalCommand(npm test*)",
          "readFile(src/**)",
          "mcp__datadog__*",
        ],
        ask: ["writeFile(.github/**)"],
        deny: ["fetchUrl", "read_file(**/.env)"],
      }),
    ).toEqual([]);
  });

  it("reports an unreadable rule as non-fatal and says it is ignored", () => {
    const errors = validateToolPermissions({ deny: ["readFile(", "ok"] });
    const unreadable = errors.find((e) => e.message.includes('"readFile("'));
    expect(unreadable).toBeDefined();
    expect(unreadable!.fatal).toBe(false);
    expect(unreadable!.message).toContain("toolPermissions.deny[0]");
    expect(unreadable!.message).toContain("ignored");
  });

  it("flags a tool name that matches nothing, so a typo in a deny rule is seen", () => {
    const errors = validateToolPermissions({ deny: ["readFiles(**/.env)"] });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("readFiles");
    expect(errors[0].message).toContain("toolPermissions.deny[0]");
    expect(errors[0].fatal).toBe(false);
  });

  it("reports the position of each bad rule", () => {
    const errors = validateToolPermissions({
      allow: ["readFile", "bogus"],
      ask: ["", "writeFile"],
    });
    expect(errors.map((e) => e.message.split(":")[0])).toEqual([
      "toolPermissions.allow[1]",
      "toolPermissions.ask[0]",
    ]);
  });
});

describe("rule names", () => {
  it("maps tools to the readable rule names", () => {
    expect(canonicalRuleName("run_terminal_command")).toBe(
      "runTerminalCommand",
    );
    expect(canonicalRuleName("read_file_range")).toBe("readFile");
    expect(canonicalRuleName("multi_edit")).toBe("writeFile");
    expect(canonicalRuleName("some_mcp_tool")).toBe("some_mcp_tool");
  });

  it("builds an MCP rule name from the server name the same way tool names do", () => {
    expect(mcpRuleName("Datadog", "query")).toBe("mcp__datadog__query");
    expect(mcpRuleName("My Server!", "go")).toBe("mcp__my_server__go");
  });
});

describe("rule targets", () => {
  it("normalises paths: slashes, leading ./, and adds the resolved path", () => {
    expect(normalizeRelative(".\\a\\b.ts")).toBe("a/b.ts");
    expect(normalizeRelative("./././x")).toBe("x");
    expect(
      ruleTargetsFor("read_file", { filepath: "./a.ts" }, "/p/a.ts"),
    ).toEqual(["a.ts", "/p/a.ts"]);
  });

  it("uses the command, the url and the search text for the other tools", () => {
    expect(ruleTargetsFor("run_terminal_command", { command: "ls" })).toEqual([
      "ls",
    ]);
    expect(
      ruleTargetsFor("fetch_url_content", { url: "https://x.dev" }),
    ).toEqual(["https://x.dev"]);
    expect(ruleTargetsFor("grep_search", { query: "TODO" })).toEqual(["TODO"]);
    expect(ruleTargetsFor("ls", {})).toEqual(["."]);
    expect(ruleTargetsFor("unknown_tool", { a: 1 })).toEqual([]);
  });
});

describe("uriToPath", () => {
  it("decodes file URIs and rejects anything else", () => {
    expect(uriToPath("file:///home/me/my%20proj/.env")).toBe(
      "/home/me/my proj/.env",
    );
    expect(uriToPath("file:///C:/proj/.env")).toBe("/C:/proj/.env");
    expect(uriToPath("https://x")).toBeUndefined();
    expect(uriToPath("not a uri")).toBeUndefined();
    expect(uriToPath(undefined)).toBeUndefined();
  });
});
