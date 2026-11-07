import { describe, expect, it, vi } from "vitest";

import { openSqliteDatabase } from "../util/sqlite.js";
import { DevDataSqliteDb } from "./devdataSqlite.js";

vi.mock("../util/sqlite.js", () => ({ openSqliteDatabase: vi.fn() }));

describe("DevDataSqliteDb without SQLite", () => {
  // e.g. Windows Smart App Control blocks the unsigned sqlite3 binary
  it("skips token logging instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(openSqliteDatabase).mockRejectedValue(
      new Error("An Application Control policy has blocked this file."),
    );
    DevDataSqliteDb.db = null;

    await expect(
      DevDataSqliteDb.logTokensGenerated("model", "provider", 10, 20),
    ).resolves.toBeUndefined();
    await expect(DevDataSqliteDb.getTokensPerDay()).resolves.toEqual([]);
    await expect(DevDataSqliteDb.getTokensPerModel()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
