import { ChunkCodebaseIndex } from "../../indexing/chunk/ChunkCodebaseIndex";
import { DatabaseConnection, SqliteDb } from "../../indexing/refreshIndex";
import { IndexResultType } from "../../indexing/types";
import { testIde } from "../fixtures";
import { addToTestDir } from "../testUtils/testDir";
import { jest } from "@jest/globals";
import {
  mockFileContents,
  mockFilename,
  mockPathAndCacheKey,
  testContinueServerClient,
  updateIndexAndAwaitGenerator,
} from "./utils";

jest.useFakeTimers();

describe("ChunkCodebaseIndex", () => {
  let index: ChunkCodebaseIndex;
  let db: DatabaseConnection;

  beforeAll(async () => {
    const pathSep = await testIde.pathSep();

    index = new ChunkCodebaseIndex(
      testIde.readFile.bind(testIde),
      pathSep,
      testContinueServerClient,
      1000,
    );

    addToTestDir([[mockFilename, mockFileContents]]);

    db = await SqliteDb.get();
  });

  it("should update the index and maintain expected database state, following the same processing order of results as the update method", async () => {
    const mockMarkComplete = jest
      .fn()
      .mockImplementation(() => Promise.resolve()) as any;

    // Compute test
    await updateIndexAndAwaitGenerator(index, "compute", mockMarkComplete);

    const computeResult = await db.get(
      "SELECT * FROM chunks WHERE cacheKey = ?",
      [mockPathAndCacheKey.cacheKey],
    );

    expect(computeResult).toBeTruthy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Compute,
    );

    // AddTag test
    await updateIndexAndAwaitGenerator(index, "addTag", mockMarkComplete);

    const addTagResult = await db.get(
      "SELECT * FROM chunk_tags WHERE chunkId = ?",
      [computeResult.id],
    );

    expect(addTagResult).toBeTruthy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.AddTag,
    );

    // RemoveTag test
    await updateIndexAndAwaitGenerator(index, "removeTag", mockMarkComplete);

    const removeTagResult = await db.get(
      "SELECT * FROM chunk_tags WHERE id = ?",
      [addTagResult.id],
    );

    expect(removeTagResult).toBeFalsy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.RemoveTag,
    );

    // Delete test
    await updateIndexAndAwaitGenerator(index, "del", mockMarkComplete);

    const delResult = await db.get("SELECT * FROM chunks WHERE id = ?", [
      computeResult.id,
    ]);

    expect(delResult).toBeFalsy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Delete,
    );
  });
});
