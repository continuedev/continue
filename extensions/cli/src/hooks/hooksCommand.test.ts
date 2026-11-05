/**
 * `cn hooks`: the command that grants and withdraws trust for a project's hooks.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hooksCommand } from "../commands/hooks.js";

import { loadHooksConfig } from "./hookConfig.js";
import { setTrustProjectHooksForRun } from "./hookTrust.js";

let root: string;
let home: string;
let project: string;
let saved: Record<string, string | undefined>;
let out: string;

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cn-hooks-")));
  home = path.join(root, "home");
  project = path.join(root, "project");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(project, ".continue"), { recursive: true });
  fs.writeFileSync(
    path.join(project, ".continue", "settings.json"),
    JSON.stringify({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "audit --log" }] }],
      },
    }),
  );
  saved = {
    CONTINUE_GLOBAL_DIR: process.env.CONTINUE_GLOBAL_DIR,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  };
  // The command reads the real home directory, so point it at the temp one.
  process.env.CONTINUE_GLOBAL_DIR = path.join(home, ".continue");
  setTrustProjectHooksForRun(false);
  out = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(root, { recursive: true, force: true });
});

const runs = () => loadHooksConfig(project).hooks.PreToolUse?.length ?? 0;

describe("cn hooks", () => {
  it("lists what would run and says it is not trusted", async () => {
    expect(await hooksCommand("list", {}, project)).toBe(0);
    expect(out).toContain("[PreToolUse] command: audit --log");
    expect(out).toContain("Not trusted");
    expect(runs()).toBe(0);
  });

  it("says so when a project defines no hooks", async () => {
    fs.rmSync(path.join(project, ".continue"), { recursive: true });
    expect(await hooksCommand(undefined, {}, project)).toBe(0);
    expect(out).toContain("defines no hooks");
  });

  it("trusts with --yes and the hooks then run", async () => {
    expect(await hooksCommand("trust", { yes: true }, project)).toBe(0);
    expect(out).toContain("Trusted");
    expect(runs()).toBe(1);
  });

  it("does not trust without a terminal to ask on", async () => {
    const original = process.stdin.isTTY;
    process.stdin.isTTY = false;
    try {
      expect(await hooksCommand("trust", {}, project)).toBe(1);
    } finally {
      process.stdin.isTTY = original;
    }
    expect(out).toContain("--yes");
    expect(runs()).toBe(0);
  });

  it("shows trusted state after trusting", async () => {
    await hooksCommand("trust", { yes: true }, project);
    out = "";
    await hooksCommand("list", {}, project);
    expect(out).toContain("Trusted: these hooks run");
  });

  it("revokes", async () => {
    await hooksCommand("trust", { yes: true }, project);
    expect(await hooksCommand("revoke", {}, project)).toBe(0);
    expect(out).toContain("Trust removed");
    expect(runs()).toBe(0);
  });

  it("rejects an unknown action", async () => {
    expect(await hooksCommand("allow", {}, project)).toBe(1);
  });

  it("refuses to trust when the Continue directory is inside the project", async () => {
    process.env.CONTINUE_GLOBAL_DIR = path.join(project, "evil");
    expect(await hooksCommand("trust", { yes: true }, project)).toBe(1);
    expect(runs()).toBe(0);
  });
});
