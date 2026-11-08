import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {},
  ConfigurationTarget: { Global: 1 },
}));

import { withoutStaleEntries } from "./yamlSchemas";

const ext = (id: string) =>
  `file:///c%3A/Users/u/.vscode/extensions/${id}/config-yaml-schema.json`;

describe("withoutStaleEntries", () => {
  it("removes this extension's entries from every version and old ID", () => {
    const matchers = [".continuous/**/*.yaml", ".continue/**/*.yaml"];
    const { schemas, removed } = withoutStaleEntries({
      [ext("b1tninja.continued-2.4.0-win32-x64")]: [".continue/**/*.yaml"],
      [ext("b1tninja.continuing-2.4.2-win32-x64")]: matchers,
      [ext("b1tninja.continuous-2.4.4-win32-x64")]: matchers,
      "/home/u/.vscode/extensions/b1tninja.continuous-2.4.4/config-yaml-schema.json":
        matchers,
    });
    expect(removed).toBe(4);
    expect(schemas).toEqual({});
  });

  it("keeps everyone else's entries", () => {
    const others = {
      [ext("continue.continue-1.2.0-win32-x64")]: [".continue/**/*.yaml"],
      "https://json.schemastore.org/github-workflow.json":
        ".github/workflows/*",
      [ext("b1tninja.continuous-2.4.4").replace(
        "config-yaml-schema",
        "other-schema",
      )]: "*.yaml",
    };
    expect(withoutStaleEntries(others)).toEqual({
      schemas: others,
      removed: 0,
    });
  });
});
