import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openSqliteDatabase } from "../../util/sqlite.js";
import AutocompleteLruCache from "./AutocompleteLruCache.js";

vi.mock("../../util/sqlite.js", () => ({ openSqliteDatabase: vi.fn() }));

const createMockDb = () => ({
  run: vi.fn().mockResolvedValue(undefined),
  all: vi.fn().mockResolvedValue([]),
  exec: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
});

describe("AutocompleteLruCache.get()", () => {
  beforeEach(() => {
    (AutocompleteLruCache as any).instancePromise = undefined;
    vi.mocked(openSqliteDatabase).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the same instance on multiple calls", async () => {
    vi.mocked(openSqliteDatabase).mockResolvedValue(createMockDb() as any);

    const instance1 = await AutocompleteLruCache.get();
    const instance2 = await AutocompleteLruCache.get();

    expect(instance1).toBe(instance2);
    expect(openSqliteDatabase).toHaveBeenCalledTimes(1);
    await instance1.close();
  });

  // e.g. Windows Smart App Control blocks the unsigned sqlite3 binary
  it("falls back to an in-memory cache when SQLite cannot be opened", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(openSqliteDatabase).mockRejectedValue(
      new Error("An Application Control policy has blocked this file."),
    );

    const cache = await AutocompleteLruCache.get();
    await cache.put("hello", "world");

    expect(await cache.get("hellowo")).toBe("rld");
    expect((cache as any).flushTimer).toBeUndefined();
    await expect(cache.flush()).resolves.toBeUndefined();
    await expect(cache.close()).resolves.toBeUndefined();
  });
});
