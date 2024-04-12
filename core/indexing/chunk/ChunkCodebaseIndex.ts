import { Chunk, IndexTag, IndexingProgressUpdate } from "../..";
import { ContinueServerClient } from "../../continueServer/stubs/client";
import { MAX_CHUNK_SIZE } from "../../llm/constants";
import { getBasename } from "../../util";
import { DatabaseConnection, SqliteDb, tagToString } from "../refreshIndex";
import {
  CodebaseIndex,
  IndexResultType,
  MarkCompleteCallback,
  RefreshIndexResults,
} from "../types";
import { chunkDocument } from "./chunk";

export class ChunkCodebaseIndex implements CodebaseIndex {
  static artifactId: string = "chunks";
  artifactId: string = ChunkCodebaseIndex.artifactId;

  constructor(
    private readonly readFile: (filepath: string) => Promise<string>,
    private readonly continueServerClient?: ContinueServerClient,
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
        `INSERT INTO chunks (cacheKey, path, idx, startLine, endLine, content) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          chunk.digest,
          chunk.filepath,
          chunk.index,
          chunk.startLine,
          chunk.endLine,
          chunk.content,
        ],
      );

      await db.run(`INSERT INTO chunk_tags (chunkId, tag) VALUES (?, ?)`, [
        lastID,
        tagString,
      ]);
    }

    // Check the remote cache
    if (this.continueServerClient !== undefined) {
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

    // Compute chunks for new files
    const contents = await Promise.all(
      results.compute.map(({ path }) => this.readFile(path)),
    );
    for (let i = 0; i < results.compute.length; i++) {
      const item = results.compute[i];

      // Insert chunks
      for await (let chunk of chunkDocument(
        item.path,
        contents[i],
        MAX_CHUNK_SIZE,
        item.cacheKey,
      )) {
        handleChunk(chunk);
      }

      yield {
        progress: i / results.compute.length,
        desc: `Chunking ${getBasename(item.path)}`,
      };
      markComplete([item], IndexResultType.Compute);
    }

    // Add tag
    for (const item of results.addTag) {
      const chunksWithPath = await db.all(
        `SELECT * FROM chunks WHERE cacheKey = ?`,
        [item.cacheKey],
      );

      for (const chunk of chunksWithPath) {
        await db.run(`INSERT INTO chunk_tags (chunkId, tag) VALUES (?, ?)`, [
          chunk.id,
          tagString,
        ]);
      }

      markComplete([item], IndexResultType.AddTag);
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
    }

    // Delete
    for (const item of results.del) {
      const deleted = await db.run(`DELETE FROM chunks WHERE cacheKey = ?`, [
        item.cacheKey,
      ]);

      // Delete from chunk_tags
      await db.run(`DELETE FROM chunk_tags WHERE chunkId = ?`, [
        deleted.lastID,
      ]);

      markComplete([item], IndexResultType.Delete);
    }
  }
}
