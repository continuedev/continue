import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("loadLocalModelFiles", () => {
  let home: string;
  let project: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "cn-home-"));
    project = fs.mkdtempSync(path.join(os.tmpdir(), "cn-project-"));
    fs.mkdirSync(path.join(project, ".continue"));
    vi.resetModules();
    vi.doMock("./env.js", () => ({ env: { continueHome: home } }));
  });
  afterEach(() => {
    vi.doUnmock("./env.js");
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  });

  it("reads accounts and the catalog, the project's replacing the global ones", async () => {
    fs.writeFileSync(
      path.join(home, "providers.yaml"),
      "providers:\n  - { name: strata, provider: openai, apiBase: 'http://127.0.0.1:8080/v1/' }\n",
    );
    fs.writeFileSync(
      path.join(home, "models.yaml"),
      "models:\n  - { name: Qwen, connection: strata, model: global }\n  - { name: Sonnet, provider: anthropic, model: claude-sonnet-4-6 }\n",
    );
    fs.writeFileSync(
      path.join(project, ".continue", "models.yaml"),
      "models:\n  - { name: Qwen, connection: strata, model: project }\n",
    );
    const { loadLocalModelFiles } = await import("./localModelFiles.js");
    const { providers, catalog } = loadLocalModelFiles(project);
    expect(providers.map((p) => p.name)).toEqual(["strata"]);
    expect(catalog.map((m) => [m.name, m.model])).toEqual([
      ["Qwen", "project"],
      ["Sonnet", "claude-sonnet-4-6"],
    ]);
  });

  it("returns nothing when neither file exists, and skips a file that does not parse", async () => {
    fs.writeFileSync(path.join(home, "models.yaml"), "models: [");
    const { loadLocalModelFiles } = await import("./localModelFiles.js");
    expect(loadLocalModelFiles(project)).toEqual({
      providers: [],
      catalog: [],
    });
  });
});
