/* eslint-disable @typescript-eslint/naming-convention */
import { FullTextSearchCodebaseIndex } from "../../indexing/FullTextSearch";
import { DatabaseConnection, SqliteDb } from "../../indexing/refreshIndex";
import { IndexResultType } from "../../indexing/types";
import {
  insertMockChunks,
  mockPathAndCacheKey,
  updateIndexAndAwaitGenerator,
} from "./utils";
import { jest } from "@jest/globals";

describe("FullTextSearchCodebaseIndex", () => {
  let index: FullTextSearchCodebaseIndex;
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = await SqliteDb.get();
    index = new FullTextSearchCodebaseIndex();
  });

  it("should update the index and maintain expected database state, following the same processing order of results as the update method", async () => {
    const mockMarkComplete = jest
      .fn()
      .mockImplementation(() => Promise.resolve()) as any;

    await insertMockChunks();

    // Compute test
    await updateIndexAndAwaitGenerator(index, "compute", mockMarkComplete);

    const computeResult = await db.get("SELECT * FROM fts WHERE path = ?", [
      mockPathAndCacheKey.path,
    ]);

    const computeResultMetadata = await db.get(
      "SELECT * FROM fts_metadata WHERE path = ?",
      [mockPathAndCacheKey.path],
    );

    expect(computeResult).toBeTruthy();
    expect(computeResultMetadata).toBeTruthy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Compute,
    );

    // AddTag test - currently, we don't do anything other than mark complete
    await updateIndexAndAwaitGenerator(index, "addTag", mockMarkComplete);

    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.AddTag,
    );

    // RemoveTag test - currently, we don't do anything other than mark complete
    await updateIndexAndAwaitGenerator(index, "removeTag", mockMarkComplete);

    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.RemoveTag,
    );

    // Delete test
    await updateIndexAndAwaitGenerator(index, "del", mockMarkComplete);

    const delResult = await db.get("SELECT * FROM fts WHERE path = ?", [
      mockPathAndCacheKey.cacheKey,
    ]);

    const delResultMetadata = await db.get(
      "SELECT * FROM fts_metadata WHERE path = ?",
      [mockPathAndCacheKey.path],
    );

    expect(delResult).toBeFalsy();
    expect(delResultMetadata).toBeFalsy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Delete,
    );
  });
});
