import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { migrateLegacyGlobalDir } from "./paths";
import {
  isIgnoreFile,
  isInWorkspaceConfigDir,
  isInWorkspaceConfigSubdir,
  isRcFile,
} from "./workspaceDirs";

describe("workspace folder names", () => {
  it("sees both .continuous and .continue folders", () => {
    expect(isInWorkspaceConfigDir("file:///w/.continuous/models.yaml")).toBe(
      true,
    );
    expect(isInWorkspaceConfigDir("file:///w/.continue/models.yaml")).toBe(
      true,
    );
    expect(isInWorkspaceConfigDir("C:\\w\\.continuous\\config.yaml")).toBe(
      true,
    );
    expect(isInWorkspaceConfigDir("/w/.continuerc.json")).toBe(false);
    expect(isInWorkspaceConfigDir("/w/src/continue/a.yaml")).toBe(false);
    expect(isInWorkspaceConfigDir("/w/.continuousx/a.yaml")).toBe(false);
  });

  it("matches a subfolder of either", () => {
    expect(
      isInWorkspaceConfigSubdir("/w/.continuous/agents/a.yaml", "agents"),
    ).toBe(true);
    expect(
      isInWorkspaceConfigSubdir("/w/.continue/agents/a.yaml", "agents"),
    ).toBe(true);
    expect(
      isInWorkspaceConfigSubdir("/w/.continuous/rules/a.md", "agents"),
    ).toBe(false);
    expect(
      isInWorkspaceConfigSubdir("/w/.continuous/agentsx/a", "agents"),
    ).toBe(false);
  });

  it("knows the ignore and rc files under both names", () => {
    expect(isIgnoreFile("file:///w/.continuousignore")).toBe(true);
    expect(isIgnoreFile("file:///w/.continueignore")).toBe(true);
    expect(isIgnoreFile("file:///w/.gitignore")).toBe(false);
    expect(isRcFile("/w/.continuousrc.json")).toBe(true);
    expect(isRcFile("/w/.continuerc.json")).toBe(true);
    expect(isRcFile("/w/.continuerc.yaml")).toBe(false);
  });
});

describe("migrateLegacyGlobalDir", () => {
  const made: string[] = [];
  const tmp = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "continuous-migrate-"));
    made.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of made.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("copies the old folder, without what is rebuilt", () => {
    const home = tmp();
    const legacy = path.join(home, ".continue");
    const dir = path.join(home, ".continuous");
    fs.mkdirSync(path.join(legacy, "sessions"), { recursive: true });
    fs.mkdirSync(path.join(legacy, "index"), { recursive: true });
    fs.mkdirSync(path.join(legacy, "rules", "index"), { recursive: true });
    fs.writeFileSync(path.join(legacy, "config.yaml"), "name: mine\n");
    fs.writeFileSync(path.join(legacy, ".env"), "KEY=1\n");
    fs.writeFileSync(path.join(legacy, "sessions", "a.json"), "{}");
    fs.writeFileSync(path.join(legacy, "index", "big.sqlite"), "x");
    fs.mkdirSync(path.join(legacy, "index", "lancedb"));
    fs.writeFileSync(
      path.join(legacy, "index", "globalContext.json"),
      JSON.stringify({
        lastSelectedProfile: path.join(legacy, "configs", "work.yaml"),
        other: "kept",
      }),
    );
    fs.writeFileSync(path.join(legacy, "rules", "index", "r.md"), "rule");

    expect(migrateLegacyGlobalDir(legacy, dir)).toBe(dir);

    expect(fs.readFileSync(path.join(dir, "config.yaml"), "utf8")).toBe(
      "name: mine\n",
    );
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "sessions", "a.json"))).toBe(true);
    // Of the index, only the saved choices
    expect(fs.readdirSync(path.join(dir, "index"))).toEqual([
      "globalContext.json",
    ]);
    const context = JSON.parse(
      fs.readFileSync(path.join(dir, "index", "globalContext.json"), "utf8"),
    );
    expect(context).toEqual({
      lastSelectedProfile: path.join(dir, "configs", "work.yaml"),
      other: "kept",
    });
    // Only the top-level index is skipped
    expect(fs.existsSync(path.join(dir, "rules", "index", "r.md"))).toBe(true);
    // The old folder is left as it was
    expect(fs.existsSync(path.join(legacy, "index", "big.sqlite"))).toBe(true);
    expect(fs.readdirSync(home).sort()).toEqual([".continue", ".continuous"]);
  });

  it("leaves an existing folder alone", () => {
    const home = tmp();
    const legacy = path.join(home, ".continue");
    const dir = path.join(home, ".continuous");
    fs.mkdirSync(legacy);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(legacy, "config.yaml"), "old");
    expect(migrateLegacyGlobalDir(legacy, dir)).toBe(dir);
    expect(fs.existsSync(path.join(dir, "config.yaml"))).toBe(false);
  });

  it("uses the new folder when there is nothing to copy", () => {
    const home = tmp();
    const dir = path.join(home, ".continuous");
    expect(migrateLegacyGlobalDir(path.join(home, ".continue"), dir)).toBe(dir);
    expect(fs.existsSync(dir)).toBe(false);
  });
});
