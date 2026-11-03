import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findSecretLine, openSecretLocation } from "./openSecretLocation";

describe("findSecretLine", () => {
  const yaml = [
    "name: test",
    "models:",
    "  - name: A",
    "    apiKey: ${{ secrets.AK }}",
    "  - name: B",
    "    apiKey: ${{secrets.owner/pkg/BK}}",
  ].join("\n");

  it("returns the 0-based line of the reference", () => {
    expect(findSecretLine(yaml, "AK")).toBe(3);
    expect(findSecretLine(yaml, "BK")).toBe(5);
  });

  it("returns -1 when the secret is not used", () => {
    expect(findSecretLine(yaml, "NOPE")).toBe(-1);
  });

  it("does not match a longer name", () => {
    expect(findSecretLine("k: ${{ secrets.AK_LONG }}", "AK")).toBe(-1);
  });

  it("handles CRLF files", () => {
    expect(findSecretLine("a: 1\r\nk: ${{ secrets.AK }}\r\n", "AK")).toBe(1);
  });
});

describe("openSecretLocation", () => {
  let dir: string;
  const ide = () => ({
    openFile: vi.fn(async () => {}),
    readFile: vi.fn(async () => "a: 1\nk: ${{ secrets.AK }}\n"),
    showLines: vi.fn(async () => {}),
  });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "open-secret-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("opens .env with a placeholder line for the env target", async () => {
    const i = ide();
    await openSecretLocation({
      ide: i,
      secretName: "AK",
      target: "env",
      continueDir: dir,
    });
    expect(fs.readFileSync(path.join(dir, ".env"), "utf8")).toBe("AK=\n");
    expect(i.openFile).toHaveBeenCalledTimes(1);
    expect((i.openFile.mock.calls[0] as unknown[])[0]).toMatch(/\.env$/);
  });

  it("shows the line that uses the secret for the configLine target", async () => {
    const i = ide();
    await openSecretLocation({
      ide: i,
      secretName: "AK",
      target: "configLine",
      continueDir: dir,
      configUri: "file:///x/config.yaml",
    });
    expect(i.showLines).toHaveBeenCalledWith("file:///x/config.yaml", 1, 2);
    expect(i.openFile).not.toHaveBeenCalled();
  });

  it("falls back to opening the file when the line is not found", async () => {
    const i = ide();
    await openSecretLocation({
      ide: i,
      secretName: "OTHER",
      target: "configLine",
      continueDir: dir,
      configUri: "file:///x/config.yaml",
    });
    expect(i.openFile).toHaveBeenCalledWith("file:///x/config.yaml");
    expect(i.showLines).not.toHaveBeenCalled();
  });

  it("rejects a secret name that is not a safe variable name", async () => {
    await expect(
      openSecretLocation({
        ide: ide(),
        secretName: "A=B",
        target: "env",
        continueDir: dir,
      }),
    ).rejects.toThrow(/not a valid secret name/);
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(false);
  });
});
