import { IContinueServerClient } from "../../continueServer/interface.js";
import { Chunk, IndexTag, IndexingProgressUpdate } from "../../index.js";
import { getBasename } from "../../util/index.js";
import { DatabaseConnection, SqliteDb, tagToString } from "../refreshIndex.js";
import {
  IndexResultType,
  MarkCompleteCallback,
  RefreshIndexResults,
  type CodebaseIndex,
} from "../types.js";
import { chunkDocument } from "./chunk.js";

export class ChunkCodebaseIndex implements CodebaseIndex {
  relativeExpectedTime: number = 1;
  static artifactId = "chunks";
  artifactId: string = ChunkCodebaseIndex.artifactId;

  constructor(
    private readonly readFile: (filepath: string) => Promise<string>,
    private readonly continueServerClient: IContinueServerClient,
    private readonly maxChunkSize: number,
  ) {
    this.readFile = readFile;
  }

  private async _createTables(db: DatabaseConnection) {
    await db.exec(`CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cacheKey TEXT NOT NULL,
      path TEXT NOT NULL,
      idx INTEGER NOT NULL,
      startLine INTEGER NOT NULL,
      endLine INTEGER NOT NULL,
      content TEXT NOT NULL
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS chunk_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL,
        chunkId INTEGER NOT NULL,
        FOREIGN KEY (chunkId) REFERENCES chunks (id)
    )`);
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate, any, unknown> {
    const db = await SqliteDb.get();
    await this._createTables(db);
    const tagString = tagToString(tag);

    async function handleChunk(chunk: Chunk) {
      const { lastID } = await db.run(
        "INSERT INTO chunks (cacheKey, path, idx, startLine, endLine, content) VALUES (?, ?, ?, ?, ?, ?)",
        [
          chunk.digest,
          chunk.filepath,
          chunk.index,
          chunk.startLine,
          chunk.endLine,
          chunk.content,
        ],
      );

      await db.run("INSERT INTO chunk_tags (chunkId, tag) VALUES (?, ?)", [
        lastID,
        tagString,
      ]);
    }

    // Check the remote cache
    if (this.continueServerClient.connected) {
      try {
        const keys = results.compute.map(({ cacheKey }) => cacheKey);
        const resp = await this.continueServerClient.getFromIndexCache(
          keys,
          "chunks",
          repoName,
        );

        for (const [cacheKey, chunks] of Object.entries(resp.files)) {
          for (const chunk of chunks) {
            await handleChunk(chunk);
          }
        }
        results.compute = results.compute.filter(
          (item) => !resp.files[item.cacheKey],
        );
      } catch (e) {
        console.error("Failed to fetch from remote cache: ", e);
      }
    }

    const progressReservedForTagging = 0.3;
    let accumulatedProgress = 0;

    // Compute chunks for new files
    const contents = await Promise.all(
      results.compute.map(({ path }) => this.readFile(path)),
    );
    for (let i = 0; i < results.compute.length; i++) {
      const item = results.compute[i];

      // Insert chunks
      for await (const chunk of chunkDocument({
        filepath: item.path,
        contents: contents[i],
        maxChunkSize: this.maxChunkSize,
        digest: item.cacheKey,
      })) {
        await handleChunk(chunk);
      }

      accumulatedProgress =
        (i / results.compute.length) * (1 - progressReservedForTagging);
      yield {
        progress: accumulatedProgress,
        desc: `Chunking ${getBasename(item.path)}`,
        status: "indexing",
      };
      markComplete([item], IndexResultType.Compute);
    }

    // Add tag
    const addContents = await Promise.all(
      results.addTag.map(({ path }) => this.readFile(path)),
    );
    for (let i = 0; i < results.addTag.length; i++) {
      const item = results.addTag[i];

      // Insert chunks
      for await (const chunk of chunkDocument({
        filepath: item.path,
        contents: contents[i],
        maxChunkSize: this.maxChunkSize,
        digest: item.cacheKey,
      })) {
        handleChunk(chunk);
      }

      markComplete([item], IndexResultType.AddTag);
      accumulatedProgress += 1 / results.addTag.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Chunking ${getBasename(item.path)}`,
        status: "indexing",
      };
    }

    // Remove tag
    for (const item of results.removeTag) {
      await db.run(
        `
        DELETE FROM chunk_tags
        WHERE tag = ?
          AND chunkId IN (
            SELECT id FROM chunks
            WHERE cacheKey = ? AND path = ?
          )
      `,
        [tagString, item.cacheKey, item.path],
      );
      markComplete([item], IndexResultType.RemoveTag);
      accumulatedProgress += 1 / results.removeTag.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getBasename(item.path)}`,
        status: "indexing",
      };
    }

    // Delete
    for (const item of results.del) {
      const deleted = await db.run("DELETE FROM chunks WHERE cacheKey = ?", [
        item.cacheKey,
      ]);

      // Delete from chunk_tags
      await db.run("DELETE FROM chunk_tags WHERE chunkId = ?", [
        deleted.lastID,
      ]);

      markComplete([item], IndexResultType.Delete);
      accumulatedProgress += 1 / results.del.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getBasename(item.path)}`,
        status: "indexing",
      };
    }
  }
}
