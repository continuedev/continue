import { Chunk, IndexingProgressUpdate } from "..";
import { DatabaseConnection, SqliteDb, tagToString } from "./refreshIndex";
import {
  CodebaseIndex,
  IndexResultType,
  IndexTag,
  MarkCompleteCallback,
  RefreshIndexResults,
} from "./types";

export class FullTextSearchCodebaseIndex implements CodebaseIndex {
  artifactId: string = "sqliteFts";

  private async _createTables(db: DatabaseConnection) {
    await db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(
        path,
        content,
        tokenize = 'trigram'
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS fts_metadata (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL,
        cacheKey TEXT NOT NULL,
        chunkId INTEGER NOT NULL,
        FOREIGN KEY (chunkId) REFERENCES chunks (id),
        FOREIGN KEY (id) REFERENCES fts (rowid)
    )`);
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
  ): AsyncGenerator<IndexingProgressUpdate, any, unknown> {
    const db = await SqliteDb.get();
    await this._createTables(db);

    for (let i = 0; i < results.compute.length; i++) {
      const item = results.compute[i];

      // Insert chunks
      const chunks = await db.all(
        `SELECT * FROM chunks WHERE path = ? AND cacheKey = ?`,
        [item.path, item.cacheKey],
      );

      for (let chunk of chunks) {
        const { lastID } = await db.run(
          `INSERT INTO fts (path, content) VALUES (?, ?)`,
          [item.path, chunk.content],
        );
        await db.run(
          `INSERT INTO fts_metadata (id, path, cacheKey, chunkId) VALUES (?, ?, ?, ?)`,
          [lastID, item.path, item.cacheKey, chunk.id],
        );
      }

      yield {
        progress: i / results.compute.length,
        desc: `Indexing ${item.path}`,
      };
      markComplete([item], IndexResultType.Compute);
    }

    // Add tag
    for (const item of results.addTag) {
      markComplete([item], IndexResultType.AddTag);
    }

    // Remove tag
    for (const item of results.removeTag) {
      markComplete([item], IndexResultType.RemoveTag);
    }

    // Delete
    for (const item of results.del) {
      const { lastID } = await db.run(
        `DELETE FROM fts_metadata WHERE path = ? AND cacheKey = ?`,
        [item.path, item.cacheKey],
      );
      await db.run(`DELETE FROM fts WHERE rowid = ?`, [lastID]);

      markComplete([item], IndexResultType.Delete);
    }
  }

  async retrieve(
    tags: IndexTag[],
    text: string,
    n: number,
    directory: string | undefined,
    filterPaths: string[] | undefined,
  ): Promise<Chunk[]> {
    const db = await SqliteDb.get();
    const tagStrings = tags.map(tagToString);

    const query = `SELECT fts_metadata.chunkId, fts_metadata.path, fts.content, rank
    FROM fts
    JOIN fts_metadata ON fts.rowid = fts_metadata.id
    JOIN chunk_tags ON fts_metadata.chunkId = chunk_tags.chunkId
    WHERE fts MATCH '${text.replace(
      /\?/g,
      "",
    )}' AND chunk_tags.tag IN (${tagStrings.map(() => "?").join(",")})
      ${
        filterPaths
          ? `AND fts_metadata.path IN (${filterPaths.map(() => "?").join(",")})`
          : ""
      }
    ORDER BY rank
    LIMIT ?`;

    const results = await db.all(query, [
      ...tagStrings,
      ...(filterPaths || []),
      n,
    ]);

    const chunks = await db.all(
      `SELECT * FROM chunks WHERE id IN (${results.map(() => "?").join(",")})`,
      results.map((result) => result.chunkId),
    );

    return chunks.map((chunk) => {
      return {
        filepath: chunk.path,
        index: chunk.index,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        digest: chunk.cacheKey,
      };
    });
  }
}
