import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  editConfigFile,
  getConfigYamlPath,
  getEditableConfigYamlPath,
  setSelectedConfigFile,
} from "./paths";

const addRule = (config: any) => ({
  ...config,
  rules: [...(config.rules ?? []), "be brief"],
});

describe("GUI edits follow the selected config", () => {
  let dir: string;
  let other: string;
  let mainBefore: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "selected-config-"));
    other = path.join(dir, "local.yaml");
    fs.writeFileSync(
      other,
      "name: Local\nversion: 1.0.0\nschema: v1\n# keep me\nmodels: []\n",
    );
    mainBefore = fs.readFileSync(getConfigYamlPath(), "utf8");
  });

  afterEach(() => {
    setSelectedConfigFile(undefined);
    fs.writeFileSync(getConfigYamlPath(), mainBefore);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("edits the selected config file and leaves config.yaml alone", () => {
    setSelectedConfigFile(pathToFileURL(other).toString());
    expect(getEditableConfigYamlPath()).toBe(other);

    editConfigFile((c) => c, addRule);

    const text = fs.readFileSync(other, "utf8");
    expect(text).toContain("be brief");
    expect(text).toContain("# keep me");
    expect(fs.readFileSync(getConfigYamlPath(), "utf8")).toBe(mainBefore);
    // No .bak is left next to a config outside ~/.continuous.
    expect(fs.existsSync(`${other}.bak`)).toBe(false);
  });

  it("edits config.yaml when the target is the main config", () => {
    setSelectedConfigFile(pathToFileURL(other).toString());
    editConfigFile((c) => c, addRule, "main");
    expect(fs.readFileSync(getConfigYamlPath(), "utf8")).toContain("be brief");
    expect(fs.readFileSync(other, "utf8")).not.toContain("be brief");
  });

  it("refuses edits when the selected config is not a local file", () => {
    setSelectedConfigFile(
      "vscode-remote://wsl+Ubuntu/home/u/.continuous/a.yaml",
    );
    expect(getEditableConfigYamlPath()).toBeUndefined();
    let ran = false;
    editConfigFile(
      (c) => c,
      (c) => {
        ran = true;
        return c;
      },
    );
    expect(ran).toBe(false);
    expect(fs.readFileSync(getConfigYamlPath(), "utf8")).toBe(mainBefore);
  });

  it("uses config.yaml when the main config is selected", () => {
    setSelectedConfigFile(undefined);
    expect(getEditableConfigYamlPath()).toBe(getConfigYamlPath());
  });
});
