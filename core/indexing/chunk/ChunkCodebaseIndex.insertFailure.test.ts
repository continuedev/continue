import { jest } from "@jest/globals";

import { testIde } from "../../test/fixtures";
import { addToTestDir } from "../../test/testDir";
import {
  mockFilename,
  mockFileContents,
  mockPathAndCacheKey,
  mockTag,
  testContinueServerClient,
} from "../test/indexing";
import { DatabaseConnection, SqliteDb } from "../refreshIndex";
import { RefreshIndexResults } from "../types";

import { cleanupAsyncEncoders } from "../../llm/countTokens";

import { ChunkCodebaseIndex } from "./ChunkCodebaseIndex";

const emptyResults: RefreshIndexResults = {
  compute: [],
  addTag: [],
  removeTag: [],
  del: [],
};

async function drain(generator: AsyncGenerator<unknown>) {
  while (!(await generator.next()).done) {}
}

describe("ChunkCodebaseIndex insert failures", () => {
  let db: DatabaseConnection;
  let index: ChunkCodebaseIndex;

  beforeAll(async () => {
    index = new ChunkCodebaseIndex(
      testIde.readFile.bind(testIde),
      testContinueServerClient,
      1000,
    );
    addToTestDir([[mockFilename, mockFileContents]]);
    db = await SqliteDb.get();
    await drain(
      index.update(mockTag, emptyResults, jest.fn() as any, "test-repo"),
    );
  });

  afterEach(async () => {
    await db.exec("DROP TRIGGER IF EXISTS chunks_fail_insert");
    await db.exec("DELETE FROM chunk_tags");
    await db.exec("DELETE FROM chunks");
  });

  afterAll(async () => {
    await cleanupAsyncEncoders();
    await db.close();
    SqliteDb.db = null;
  });

  it("marks a file indexed after chunk rows and tags are committed", async () => {
    const markComplete = jest.fn(async () => undefined);
    await drain(
      index.update(
        mockTag,
        { ...emptyResults, compute: [mockPathAndCacheKey] },
        markComplete as any,
        "test-repo",
      ),
    );

    expect(markComplete).toHaveBeenCalledWith([mockPathAndCacheKey], "compute");
    const chunks = await db.all("SELECT cacheKey, path FROM chunks");
    const tags = await db.all("SELECT chunkId, tag FROM chunk_tags");
    expect(chunks.length).toBeGreaterThan(0);
    expect(tags).toHaveLength(chunks.length);
    expect(chunks.every((row) => row.cacheKey === "abc123")).toBe(true);
  });

  it("does not mark a file indexed when a chunk insert fails", async () => {
    await db.exec(`
      CREATE TRIGGER chunks_fail_insert
      BEFORE INSERT ON chunks
      BEGIN
        SELECT RAISE(ABORT, 'forced chunk insert failure');
      END
    `);

    const markComplete = jest.fn(async () => undefined);
    const generator = index.update(
      mockTag,
      { ...emptyResults, compute: [mockPathAndCacheKey] },
      markComplete as any,
      "test-repo",
    );

    await expect(drain(generator)).rejects.toThrow(
      /forced chunk insert failure/,
    );
    expect(markComplete).not.toHaveBeenCalled();
    expect(await db.all("SELECT id FROM chunks")).toEqual([]);
    expect(await db.all("SELECT id FROM chunk_tags")).toEqual([]);
  });
});
