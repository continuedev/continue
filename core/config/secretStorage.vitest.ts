import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as dotenv from "dotenv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SECURE_STORAGE_TIMEOUT_MS,
  isSecureStorageAvailable,
  removeEnvSecret,
  storeSecret,
} from "./secretStorage";

function memoryIde(options: { keep?: boolean } = {}) {
  const store: Record<string, string> = {};
  return {
    store,
    ide: {
      writeSecrets: vi.fn(async (s: Record<string, string>) => {
        if (options.keep !== false) Object.assign(store, s);
      }),
      readSecrets: vi.fn(async (keys: string[]) =>
        Object.fromEntries(
          keys.filter((k) => k in store).map((k) => [k, store[k]]),
        ),
      ),
    },
  };
}

describe("isSecureStorageAvailable", () => {
  it("is false, rather than hanging, when the IDE never replies", async () => {
    vi.useFakeTimers();
    try {
      const never = () => new Promise<never>(() => {});
      const result = isSecureStorageAvailable({
        writeSecrets: never,
        readSecrets: never,
      });
      await vi.advanceTimersByTimeAsync(SECURE_STORAGE_TIMEOUT_MS + 1);
      expect(await result).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is true when a write reads back", async () => {
    expect(await isSecureStorageAvailable(memoryIde().ide)).toBe(true);
  });

  it("is false when nothing is kept (CLI, test host)", async () => {
    expect(await isSecureStorageAvailable(memoryIde({ keep: false }).ide)).toBe(
      false,
    );
  });

  it("is false when the storage throws", async () => {
    const ide = {
      writeSecrets: async () => {
        throw new Error("no keychain");
      },
      readSecrets: async () => ({}),
    };
    expect(await isSecureStorageAvailable(ide)).toBe(false);
  });
});

describe("storeSecret", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-secret-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("writes to secure storage", async () => {
    const { ide, store } = memoryIde();
    const result = await storeSecret({
      ide,
      name: "CONTINUED_ANTHROPIC_API_KEY",
      value: "sk-ant-1",
      storage: "secure",
      continueDir: dir,
    });
    expect(result).toEqual({ stored: true, location: "secure" });
    expect(store.CONTINUED_ANTHROPIC_API_KEY).toBe("sk-ant-1");
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(false);
  });

  it("flags a plaintext copy in ~/.continue/.env without touching it", async () => {
    fs.writeFileSync(path.join(dir, ".env"), "K=old\n");
    const result = await storeSecret({
      ide: memoryIde().ide,
      name: "K",
      value: "new",
      storage: "secure",
      continueDir: dir,
    });
    expect(result.stored).toBe(true);
    expect(result.envShadowed).toBe(true);
    expect(fs.readFileSync(path.join(dir, ".env"), "utf8")).toBe("K=old\n");
  });

  it("does not flag when .env has no value for the name", async () => {
    fs.writeFileSync(path.join(dir, ".env"), "OTHER=1\n");
    const result = await storeSecret({
      ide: memoryIde().ide,
      name: "K",
      value: "new",
      storage: "secure",
      continueDir: dir,
    });
    expect(result.envShadowed).toBeUndefined();
  });

  it("reports an error when secure storage drops the value", async () => {
    const result = await storeSecret({
      ide: memoryIde({ keep: false }).ide,
      name: "K",
      value: "v",
      storage: "secure",
      continueDir: dir,
    });
    expect(result.stored).toBe(false);
    expect(result.error).toMatch(/secure storage/);
  });

  it("writes to .env", async () => {
    const result = await storeSecret({
      ide: memoryIde().ide,
      name: "K",
      value: "has space",
      storage: "env",
      continueDir: dir,
    });
    expect(result).toEqual({ stored: true, location: "env" });
    expect(
      dotenv.parse(fs.readFileSync(path.join(dir, ".env"), "utf8")).K,
    ).toBe("has space");
  });

  it("rejects an invalid name and an empty value", async () => {
    const base = {
      ide: memoryIde().ide,
      storage: "env" as const,
      continueDir: dir,
    };
    expect(
      (await storeSecret({ ...base, name: "bad name", value: "v" })).error,
    ).toMatch(/not a valid secret name/);
    expect((await storeSecret({ ...base, name: "K", value: "" })).stored).toBe(
      false,
    );
  });

  it("never puts the value in the result", async () => {
    const result = await storeSecret({
      ide: memoryIde().ide,
      name: "K",
      value: "line1\nhunter2",
      storage: "env",
      continueDir: dir,
    });
    expect(result.stored).toBe(false);
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });
});

describe("removeEnvSecret", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "remove-env-secret-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const envPath = () => path.join(dir, ".env");

  it("removes only that line once the key is in secure storage", async () => {
    fs.writeFileSync(envPath(), "# keys\nA=1\nK=old\nB=2\n");
    const { ide } = memoryIde();
    await storeSecret({
      ide,
      name: "K",
      value: "new",
      storage: "secure",
      continueDir: dir,
    });
    expect(await removeEnvSecret({ ide, name: "K", continueDir: dir })).toEqual(
      { removed: true },
    );
    expect(fs.readFileSync(envPath(), "utf8")).toBe("# keys\nA=1\nB=2\n");
  });

  it("keeps the line when the key is not in secure storage", async () => {
    fs.writeFileSync(envPath(), "K=old\n");
    const result = await removeEnvSecret({
      ide: memoryIde().ide,
      name: "K",
      continueDir: dir,
    });
    expect(result.removed).toBe(false);
    expect(result.error).toBeDefined();
    expect(fs.readFileSync(envPath(), "utf8")).toBe("K=old\n");
  });

  it("rejects an invalid name and never puts a value in the error", async () => {
    const result = await removeEnvSecret({
      ide: memoryIde().ide,
      name: "../x",
      continueDir: dir,
    });
    expect(result.removed).toBe(false);
  });
});
