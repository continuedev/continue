import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

async function createLoader(configYaml?: string) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "continue-local-profile-loader-"),
  );
  process.env.CONTINUE_GLOBAL_DIR = tempDir;

  if (configYaml !== undefined) {
    fs.writeFileSync(path.join(tempDir, "config.yaml"), configYaml);
  }

  vi.resetModules();
  const { default: LocalProfileLoader } = await import("./LocalProfileLoader");

  return {
    tempDir,
    loader: new LocalProfileLoader({} as any, {} as any, {} as any),
  };
}

afterEach(() => {
  delete process.env.CONTINUE_GLOBAL_DIR;
  vi.restoreAllMocks();
});

describe("LocalProfileLoader", () => {
  it("uses name from default local config.yaml for the profile title", async () => {
    const { loader, tempDir } = await createLoader(
      "name: Custom Local Profile\nversion: '1.0'",
    );
    expect(loader.description.title).toBe("Custom Local Profile");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("falls back to Local Config when default config.yaml is malformed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loader, tempDir } = await createLoader("name: [");
    expect(loader.description.title).toBe("Local Config");
    expect(errorSpy).toHaveBeenCalled();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("falls back to Local Config when name is missing", async () => {
    const { loader, tempDir } = await createLoader("models: []");
    expect(loader.description.title).toBe("Local Config");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
