import { describe, expect, it } from "vitest";
import { ALLOW, ASK, decide, OFF, read } from "./decideTestUtils";

describe("decideToolCall: files", () => {
  it("denies reading .env wherever it is", () => {
    const perms = { deny: ["readFile(**/.env)"] };
    expect(decide(perms, read(".env")).policy).toBe(OFF);
    expect(decide(perms, read("./config/prod/.env")).policy).toBe(OFF);
    expect(decide(perms, read("config\\prod\\.env")).policy).toBe(OFF);
    expect(decide(perms, read("src/app.ts")).policy).toBe(ASK);
  });

  it("denies by the resolved path even if the model wrote a relative one", () => {
    const d = decide(
      { deny: ["readFile(**/.env)"] },
      { ...read("../secrets"), resolvedPath: "/home/me/proj/secrets/.env" },
    );
    expect(d.policy).toBe(OFF);
  });

  it("the readFile rule covers read_file_range and the snake_case name", () => {
    expect(
      decide(
        { deny: ["readFile(**/.env)"] },
        { toolName: "read_file_range", parsedArgs: { filepath: ".env" } },
      ).policy,
    ).toBe(OFF);
    expect(decide({ deny: ["read_file(**/.env)"] }, read(".env")).policy).toBe(
      OFF,
    );
  });

  it("allow applies to a path inside the root", () => {
    const perms = { allow: ["readFile(src/**)"] };
    expect(decide(perms, read("src/a/b.ts")).policy).toBe(ALLOW);
    expect(decide(perms, read("./src/a.ts")).policy).toBe(ALLOW);
    expect(decide(perms, read("docs/a.md")).policy).toBe(ASK);
  });

  it("allow never applies to a path that climbs out of the root", () => {
    const perms = { allow: ["readFile(src/**)"] };
    expect(decide(perms, read("src/../../etc/passwd")).policy).toBe(ASK);
    expect(decide(perms, read("../src/a.ts")).policy).toBe(ASK);
    expect(decide(perms, read("/abs/src/a.ts")).policy).toBe(ASK);
  });

  it("a write rule covers every edit tool", () => {
    const perms = { ask: ["writeFile(.github/**)"] };
    for (const toolName of [
      "create_new_file",
      "edit_existing_file",
      "multi_edit",
    ]) {
      expect(
        decide(perms, {
          toolName,
          parsedArgs: { filepath: ".github/workflows/x.yml" },
          base: ALLOW,
          evaluated: ALLOW,
        }).policy,
      ).toBe(ASK);
    }
  });

  it("ls defaults to the current directory", () => {
    expect(
      decide({ deny: ["listDirectory(.)"] }, { toolName: "ls", parsedArgs: {} })
        .policy,
    ).toBe(OFF);
  });
});

describe("decideToolCall: MCP", () => {
  const mcp = { serverName: "Datadog", toolName: "query_metrics" };
  const call = { toolName: "datadog_query_metrics", parsedArgs: {}, mcp };

  it("matches a server wildcard", () => {
    expect(decide({ allow: ["mcp__datadog__*"] }, call).policy).toBe(ALLOW);
    expect(decide({ allow: ["mcp__wiz__*"] }, call).policy).toBe(ASK);
  });

  it("lets a deny on one tool beat a wildcard allow", () => {
    const perms = {
      allow: ["mcp__datadog__*"],
      deny: ["mcp__datadog__query_metrics"],
    };
    expect(decide(perms, call).policy).toBe(OFF);
  });

  it("normalises the server name like the tool name does", () => {
    const d = decide(
      { allow: ["mcp__my_server__*"] },
      {
        toolName: "x",
        parsedArgs: {},
        mcp: { serverName: "My Server!", toolName: "go" },
      },
    );
    expect(d.policy).toBe(ALLOW);
  });
});
