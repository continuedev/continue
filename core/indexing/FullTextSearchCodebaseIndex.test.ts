import { jest } from "@jest/globals";

import {
  insertMockChunks,
  mockPathAndCacheKey,
  updateIndexAndAwaitGenerator,
} from "./test/indexing";

import { FullTextSearchCodebaseIndex } from "./FullTextSearchCodebaseIndex";
import { DatabaseConnection, SqliteDb } from "./refreshIndex";
import { IndexResultType } from "./types";

describe.skip("FullTextSearchCodebaseIndex", () => {
  let index: FullTextSearchCodebaseIndex;
  let db: DatabaseConnection;

  async function getFts() {
    return await db.all("SELECT * FROM fts");
  }

  async function getFtsMetadata() {
    return await db.all("SELECT * FROM fts_metadata");
  }

  beforeEach(async () => {
    db = await SqliteDb.get();
    index = new FullTextSearchCodebaseIndex();
  });

  it("should update the index and maintain expected database state", async () => {
    const mockMarkComplete = jest
      .fn()
      .mockImplementation(() => Promise.resolve()) as any;

    await insertMockChunks();

    // Compute test
    await updateIndexAndAwaitGenerator(index, "compute", mockMarkComplete);
    expect((await getFts()).length).toBe(1);
    expect((await getFtsMetadata()).length).toBe(1);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Compute,
    );

    // RemoveTag test - currently, we don't do anything other than mark complete
    await updateIndexAndAwaitGenerator(index, "removeTag", mockMarkComplete);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.RemoveTag,
    );

    // AddTag test - currently, we don't do anything other than mark complete
    await updateIndexAndAwaitGenerator(index, "addTag", mockMarkComplete);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.AddTag,
    );

    // Delete test
    await updateIndexAndAwaitGenerator(index, "del", mockMarkComplete);
    expect((await getFts()).length).toBe(0);
    expect((await getFtsMetadata()).length).toBe(0);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Delete,
    );
  });
});
