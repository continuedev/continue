import { jest } from "@jest/globals";

import { testIde } from "../../test/fixtures";
import {
  mockFileContents,
  mockFilename,
  mockPathAndCacheKey,
  testContinueServerClient,
  updateIndexAndAwaitGenerator,
} from "../test/indexing";
import { addToTestDir } from "../../test/testDir";
import { DatabaseConnection, SqliteDb } from "../refreshIndex";
import { IndexResultType } from "../types";

import { ChunkCodebaseIndex } from "./ChunkCodebaseIndex";

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
    index = new ChunkCodebaseIndex(
      testIde.readFile.bind(testIde),
      testContinueServerClient,
      1000,
    );

    addToTestDir([[mockFilename, mockFileContents]]);

    db = await SqliteDb.get();
  });

  it.skip("should update the index and maintain expected database state, following the same processing order of results as the update method", async () => {
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
