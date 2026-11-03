import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as YAML from "yaml";

const SOURCE = `# my config
name: Local
version: 1.0.0
schema: v1

models:
  - name: Opus # keep
    provider: anthropic
    model: claude-opus
    apiKey: \${{ secrets.ANTHROPIC_API_KEY }}

toolPermissions:
  # never
  deny:
    - readFile(**/.env)
`;

describe("addToolRule", () => {
  let dir: string;
  let cfg: string;
  let addToolRule: typeof import("./addRule").addToolRule;
  let load: typeof import("./evaluate").evaluateToolPolicyWithRules;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "add-rule-"));
    process.env.CONTINUE_GLOBAL_DIR = dir;
    cfg = path.join(dir, "config.yaml");
    fs.writeFileSync(cfg, SOURCE);
    vi.resetModules();
    ({ addToolRule } = await import("./addRule"));
    ({ evaluateToolPolicyWithRules: load } = await import("./evaluate"));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const read = () => YAML.parse(fs.readFileSync(cfg, "utf8"));

  it("adds a rule, keeping comments, the secret reference and other rules", () => {
    expect(addToolRule("allow", "runTerminalCommand(npm test)")).toBe("added");
    const text = fs.readFileSync(cfg, "utf8");
    expect(text).toContain("# my config");
    expect(text).toContain("# keep");
    expect(text).toContain("# never");
    expect(text).toContain("${{ secrets.ANTHROPIC_API_KEY }}");
    expect(read().toolPermissions).toEqual({
      deny: ["readFile(**/.env)"],
      allow: ["runTerminalCommand(npm test)"],
    });
  });

  it("creates the block when there is none", () => {
    fs.writeFileSync(cfg, "name: x\nversion: 1.0.0\n");
    expect(addToolRule("allow", "readFile(src/a.ts)")).toBe("added");
    expect(read().toolPermissions).toEqual({ allow: ["readFile(src/a.ts)"] });
  });

  it("does not add the same rule twice and does not touch the file", () => {
    addToolRule("allow", "runTerminalCommand(ls)");
    const before = fs.readFileSync(cfg, "utf8");
    expect(addToolRule("allow", "runTerminalCommand(ls)")).toBe("exists");
    expect(fs.readFileSync(cfg, "utf8")).toBe(before);
  });

  it("appends in order", () => {
    addToolRule("allow", "runTerminalCommand(a)");
    addToolRule("allow", "runTerminalCommand(b)");
    expect(read().toolPermissions.allow).toEqual([
      "runTerminalCommand(a)",
      "runTerminalCommand(b)",
    ]);
  });

  it("refuses a rule that would not parse, and writes nothing", () => {
    expect(addToolRule("allow", "readFile(")).toBe("invalid");
    expect(addToolRule("allow", "")).toBe("invalid");
    expect(fs.readFileSync(cfg, "utf8")).toBe(SOURCE);
  });

  it("reports no-config for a config.json user", () => {
    fs.rmSync(cfg);
    fs.writeFileSync(path.join(dir, "config.json"), "{}");
    expect(addToolRule("allow", "readFile(a)")).toBe("no-config");
    expect(fs.existsSync(cfg)).toBe(false);
  });

  it("the rule it writes takes effect on the very next call", () => {
    addToolRule("allow", "runTerminalCommand(npm test)");
    const perms = read().toolPermissions;
    const decide = (command: string) =>
      load({
        tool: { group: "Built-In" } as any,
        toolName: "run_terminal_command",
        basePolicy: "allowedWithPermission",
        parsedArgs: { command },
        permissions: perms,
      }).policy;
    expect(decide("npm test")).toBe("allowedWithoutPermission");
    expect(decide("npm test --force")).toBe("allowedWithPermission");
    expect(decide("sudo npm test")).toBe("allowedWithPermission");
  });

  it("an always-allow cannot undo an existing deny", () => {
    addToolRule("allow", "readFile(config/prod/.env)");
    const perms = read().toolPermissions;
    const r = load({
      tool: { group: "Built-In" } as any,
      toolName: "read_file",
      basePolicy: "allowedWithPermission",
      parsedArgs: { filepath: "config/prod/.env" },
      permissions: perms,
    });
    expect(r.policy).toBe("disabled");
    expect(r.source).toBe("deny-rule");
  });
});
