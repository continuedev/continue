import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureSecretPlaceholder } from "./secretsFile";

describe("ensureSecretPlaceholder", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const read = () => fs.readFileSync(path.join(dir, ".env"), "utf8");

  it("creates the file with an empty NAME= line", () => {
    const file = ensureSecretPlaceholder(dir, "ANTHROPIC_API_KEY");
    expect(file).toBe(path.join(dir, ".env"));
    expect(read()).toBe("ANTHROPIC_API_KEY=\n");
  });

  it("appends after existing content without touching it", () => {
    fs.writeFileSync(path.join(dir, ".env"), "OTHER=keep\n");
    ensureSecretPlaceholder(dir, "NEW_KEY");
    expect(read()).toBe("OTHER=keep\nNEW_KEY=\n");
  });

  it("adds a newline first when the file does not end with one", () => {
    fs.writeFileSync(path.join(dir, ".env"), "OTHER=keep");
    ensureSecretPlaceholder(dir, "NEW_KEY");
    expect(read()).toBe("OTHER=keep\nNEW_KEY=\n");
  });

  it("never overwrites a value that is already there", () => {
    fs.writeFileSync(path.join(dir, ".env"), "AK=secret-value\n");
    ensureSecretPlaceholder(dir, "AK");
    expect(read()).toBe("AK=secret-value\n");
  });

  it("treats an empty or exported existing line as already listed", () => {
    fs.writeFileSync(path.join(dir, ".env"), "export AK=\n");
    ensureSecretPlaceholder(dir, "AK");
    expect(read()).toBe("export AK=\n");
  });

  it("does not mistake a longer name for the same name", () => {
    fs.writeFileSync(path.join(dir, ".env"), "AK_EXTRA=1\n");
    ensureSecretPlaceholder(dir, "AK");
    expect(read()).toBe("AK_EXTRA=1\nAK=\n");
  });

  it("refuses a name that is not a safe variable name", () => {
    expect(() => ensureSecretPlaceholder(dir, "A=B\nC")).toThrow(
      /not a valid secret name/,
    );
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(false);
  });
});
