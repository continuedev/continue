import { beforeEach, describe, expect, it } from "vitest";

import { FullTextSearchCodebaseIndex } from "./FullTextSearchCodebaseIndex";
import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex";
import { DatabaseConnection, SqliteDb } from "./refreshIndex";
import { tagToString } from "./utils";

const TEST_TAG = { branch: "main", directory: "/test" } as const;

describe("FullTextSearchCodebaseIndex", () => {
  let db: DatabaseConnection;
  let index: FullTextSearchCodebaseIndex;

  beforeEach(async () => {
    index = new FullTextSearchCodebaseIndex();
    db = await SqliteDb.get();

    await db.exec(
      "CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(path, content, tokenize = 'trigram')",
    );
    await db.exec(
      "CREATE TABLE IF NOT EXISTS fts_metadata (id INTEGER PRIMARY KEY, path TEXT NOT NULL, cacheKey TEXT NOT NULL, chunkId INTEGER NOT NULL)",
    );
    await db.exec(
      "CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY AUTOINCREMENT, cacheKey TEXT NOT NULL, path TEXT NOT NULL, idx INTEGER NOT NULL, startLine INTEGER NOT NULL, endLine INTEGER NOT NULL, content TEXT NOT NULL)",
    );
    await db.exec(
      "CREATE TABLE IF NOT EXISTS chunk_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL, chunkId INTEGER NOT NULL, UNIQUE (tag, chunkId))",
    );

    await db.exec("DELETE FROM fts");
    await db.exec("DELETE FROM fts_metadata");
    await db.exec("DELETE FROM chunk_tags");
    await db.exec("DELETE FROM chunks");

    await db.run(
      "INSERT INTO chunks (cacheKey, path, idx, startLine, endLine, content) VALUES ('cache-key', '/test/hello.ts', 0, 0, 3, 'hello world the test content')",
    );
    const row = (await db.get("SELECT id FROM chunks LIMIT 1")) as {
      id: number;
    };
    await db.run("INSERT INTO chunk_tags (tag, chunkId) VALUES (?, ?)", [
      tagToString({ ...TEST_TAG, artifactId: ChunkCodebaseIndex.artifactId }),
      row.id,
    ]);
    await db.run(
      "INSERT INTO fts (rowid, path, content) VALUES (?, '/test/hello.ts', 'hello world the test content')",
      [row.id],
    );
    await db.run(
      "INSERT INTO fts_metadata (id, path, cacheKey, chunkId) VALUES (?, '/test/hello.ts', 'cache-key', ?)",
      [row.id, row.id],
    );
  });

  it("finds matching chunks for a trigram query", async () => {
    const chunks = await index.retrieve({
      tags: [TEST_TAG],
      text: '"hello world" OR "the test"',
      n: 10,
      bm25Threshold: 0,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain("hello world");
  });

  it("returns no chunks for an empty query instead of throwing an FTS5 syntax error", async () => {
    await expect(
      index.retrieve({ tags: [TEST_TAG], text: "", n: 10 }),
    ).resolves.toEqual([]);
  });
});
