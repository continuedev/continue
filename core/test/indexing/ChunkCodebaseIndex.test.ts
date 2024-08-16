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

  async function getAllChunks() {
    return await db.all("SELECT * FROM chunks");
  }

  async function getAllChunkTags() {
    return await db.all("SELECT * FROM chunk_tags");
  }

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
    expect((await getAllChunks()).length).toBe(1);
    expect((await getAllChunkTags()).length).toBe(1);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Compute,
    );

    // RemoveTag test
    await updateIndexAndAwaitGenerator(index, "removeTag", mockMarkComplete);
    expect((await getAllChunkTags()).length).toBe(0);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.RemoveTag,
    );

    // AddTag test
    await updateIndexAndAwaitGenerator(index, "addTag", mockMarkComplete);
    expect((await getAllChunkTags()).length).toBe(1);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.AddTag,
    );

    // Delete test
    await updateIndexAndAwaitGenerator(index, "del", mockMarkComplete);
    expect((await getAllChunks()).length).toBe(0);
    expect((await getAllChunkTags()).length).toBe(0);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Delete,
    );
  });
});
