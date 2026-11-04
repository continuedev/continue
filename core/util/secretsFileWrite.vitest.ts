import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as dotenv from "dotenv";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  envFileHasValue,
  formatEnvValue,
  readSecretFromEnvFile,
  removeSecretFromEnvFile,
  setSecretInEnvFile,
} from "./secretsFile";

describe("setSecretInEnvFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-file-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const read = () => fs.readFileSync(path.join(dir, ".env"), "utf8");

  it("creates the file with owner-only permissions", () => {
    setSecretInEnvFile(dir, "CONTINUED_ANTHROPIC_API_KEY", "sk-ant-123");
    expect(read()).toBe("CONTINUED_ANTHROPIC_API_KEY=sk-ant-123\n");
    if (process.platform !== "win32") {
      expect(fs.statSync(path.join(dir, ".env")).mode & 0o777).toBe(0o600);
    }
  });

  it("replaces an existing line and keeps the others", () => {
    fs.writeFileSync(
      path.join(dir, ".env"),
      "# keys\nA=1\nexport CONTINUED_X_API_KEY=\nB=2\n",
    );
    setSecretInEnvFile(dir, "CONTINUED_X_API_KEY", "new");
    expect(read()).toBe("# keys\nA=1\nCONTINUED_X_API_KEY=new\nB=2\n");
  });

  it("appends to a file without a trailing newline", () => {
    fs.writeFileSync(path.join(dir, ".env"), "A=1");
    setSecretInEnvFile(dir, "B", "2");
    expect(read()).toBe("A=1\nB=2\n");
  });

  it("keeps CRLF line endings", () => {
    fs.writeFileSync(path.join(dir, ".env"), "A=1\r\nB=2\r\n");
    setSecretInEnvFile(dir, "A", "9");
    expect(read()).toBe("A=9\r\nB=2\r\n");
  });

  it("does not match a name that is a prefix of another", () => {
    fs.writeFileSync(path.join(dir, ".env"), "KEY_LONG=1\n");
    setSecretInEnvFile(dir, "KEY", "2");
    expect(read()).toBe("KEY_LONG=1\nKEY=2\n");
  });

  it("rejects names that are not environment variable names", () => {
    for (const bad of ["", "1ABC", "A B", "A=B", "A\nB", "../x", "a-b"]) {
      expect(() => setSecretInEnvFile(dir, bad, "v")).toThrow(
        /not a valid secret name/,
      );
    }
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(false);
  });

  it("rejects values with line breaks without echoing them", () => {
    let message = "";
    try {
      setSecretInEnvFile(dir, "A", "hunter2\nsecond");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/line breaks/);
    expect(message).not.toContain("hunter2");
  });

  it.each([
    "sk-ant-api03-AbC_123",
    "has space",
    "has # hash",
    "it's",
    'say "hi"',
    "dollar $HOME and \\ backslash",
    "a=b",
  ])("round-trips %j through dotenv", (value) => {
    setSecretInEnvFile(dir, "K", value);
    expect(dotenv.parse(read()).K).toBe(value);
  });

  it("refuses a value holding every quote kind", () => {
    expect(() => formatEnvValue(`'"\``)).toThrow(/cannot be stored/);
  });
});

describe("envFileHasValue", () => {
  it("is false for a placeholder line and true once set", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-file-"));
    try {
      expect(envFileHasValue(dir, "K")).toBe(false);
      fs.writeFileSync(path.join(dir, ".env"), "K=\n");
      expect(envFileHasValue(dir, "K")).toBe(false);
      setSecretInEnvFile(dir, "K", "v");
      expect(envFileHasValue(dir, "K")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("removeSecretFromEnvFile and readSecretFromEnvFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-remove-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = () => path.join(dir, ".env");

  it("removes the line (with or without export) and keeps the rest", () => {
    fs.writeFileSync(file(), "# c\nA=1\nexport K=secret\nB=2\n");
    expect(removeSecretFromEnvFile(dir, "K")).toBe(true);
    expect(fs.readFileSync(file(), "utf8")).toBe("# c\nA=1\nB=2\n");
  });

  it("keeps CRLF line endings and does not match a longer name", () => {
    fs.writeFileSync(file(), "K_LONG=1\r\nK=2\r\n");
    expect(removeSecretFromEnvFile(dir, "K")).toBe(true);
    expect(fs.readFileSync(file(), "utf8")).toBe("K_LONG=1\r\n");
  });

  it("returns false when there is no such line or no file", () => {
    expect(removeSecretFromEnvFile(dir, "K")).toBe(false);
    fs.writeFileSync(file(), "A=1\n");
    expect(removeSecretFromEnvFile(dir, "K")).toBe(false);
    expect(fs.readFileSync(file(), "utf8")).toBe("A=1\n");
  });

  it("refuses, leaving the file alone, when the value spans lines", () => {
    const text = 'K="line1\nB=2\nline3"\nA=1\n';
    fs.writeFileSync(file(), text);
    expect(() => removeSecretFromEnvFile(dir, "K")).toThrow(/by hand/);
    expect(fs.readFileSync(file(), "utf8")).toBe(text);
  });

  it("reads a value back, and nothing for an empty or missing one", () => {
    expect(readSecretFromEnvFile(dir, "K")).toBeUndefined();
    fs.writeFileSync(file(), "K='a b'\nE=\n");
    expect(readSecretFromEnvFile(dir, "K")).toBe("a b");
    expect(readSecretFromEnvFile(dir, "E")).toBeUndefined();
  });
});
