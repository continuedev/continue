import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  workspace: {},
}));

import { contributedSettingKeys } from "./migrateSettings";

const packageJSON = require("../../package.json");

describe("contributedSettingKeys", () => {
  it("lists the manifest's continuous.* settings", () => {
    const keys = contributedSettingKeys(packageJSON);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys).toContain("continuous.enableTabAutocomplete");
    expect(keys.every((key) => key.startsWith("continuous."))).toBe(true);
  });

  it("contributes no continue.* names any more", () => {
    const text = JSON.stringify(packageJSON.contributes);
    expect(text).not.toMatch(/"continue\.[A-Za-z]/);
    expect(text).not.toMatch(/config\.continue\./);
  });

  it("reads one configuration section or a list of them", () => {
    expect(
      contributedSettingKeys({
        contributes: {
          configuration: [
            { properties: { "continuous.a": {} } },
            { properties: { "continuous.b": {}, "other.c": {} } },
          ],
        },
      }),
    ).toEqual(["continuous.a", "continuous.b"]);
    expect(contributedSettingKeys({})).toEqual([]);
  });
});
