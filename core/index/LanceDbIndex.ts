import { v4 as uuidv4 } from "uuid";
// NOTE: vectordb requirement must be listed in extensions/vscode to avoid error
import * as lancedb from "vectordb";
import {
  CodebaseIndex,
  IndexTag,
  PathAndCacheKey,
  RefreshIndexResults,
} from ".";
import { Chunk, EmbeddingsProvider } from "..";
import { getLanceDbPath } from "../util/paths";
import { chunkDocument } from "./chunk/chunk";
import { DatabaseConnection, SqliteDb } from "./refreshIndex";

export function tagToString(tag: IndexTag): string {
  return `${tag.directory}::${tag.branch}::${tag.artifactId}`;
}

interface LanceDbRow {
  uuid: string;
  path: string;
  cacheKey: string;
  vector: number[];
  [key: string]: any;
}

export class LanceDbIndex implements CodebaseIndex {
  get artifactId(): string {
    return "vectordb::" + this.embeddingsProvider.id;
  }

  static MAX_CHUNK_SIZE = 512;

  embeddingsProvider: EmbeddingsProvider;
  readFile: (filepath: string) => Promise<string>;

  constructor(
    embeddingsProvider: EmbeddingsProvider,
    readFile: (filepath: string) => Promise<string>
  ) {
    this.embeddingsProvider = embeddingsProvider;
    this.readFile = readFile;
  }

  private tableNameForTag(tag: IndexTag) {
    return tagToString(tag);
  }

  private async createSqliteCacheTable(db: DatabaseConnection) {
    await db.exec(`CREATE TABLE IF NOT EXISTS lance_db_cache (
        uuid TEXT PRIMARY KEY,
        cacheKey TEXT NOT NULL,
        path TEXT NOT NULL,
        vector TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        contents TEXT NOT NULL
    )`);
  }

  private async *computeChunks(
    items: PathAndCacheKey[],
    tagString: string
  ): AsyncGenerator<
    [
      number,
      LanceDbRow,
      { startLine: number; endLine: number; contents: string },
    ]
  > {
    const contents = await Promise.all(
      items.map(({ path }) => this.readFile(path))
    );

    for (let i = 0; i < items.length; i++) {
      // Break into chunks
      const content = contents[i];
      const chunks: Chunk[] = [];

      for await (let chunk of chunkDocument(
        items[i].path,
        content,
        LanceDbIndex.MAX_CHUNK_SIZE,
        items[i].cacheKey
      )) {
        chunks.push(chunk);
      }

      // Calculate embeddings
      const embeddings = await this.embeddingsProvider.embed(
        chunks.map((c) => c.content)
      );

      // Create row format
      for (let j = 0; j < chunks.length; j++) {
        const progress = (i + j / chunks.length) / items.length;
        const row = { vector: embeddings[j], ...items[i], uuid: uuidv4() };
        const chunk = chunks[j];
        yield [
          progress,
          row,
          {
            contents: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
          },
        ];
      }
    }
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults
  ): AsyncGenerator<number> {
    const tagString = tagToString(tag);
    const tableName = this.tableNameForTag(tag);
    const db = await lancedb.connect(getLanceDbPath());
    const existingTables = await db.tableNames();

    const sqlite = await SqliteDb.get();
    await this.createSqliteCacheTable(sqlite);

    // Compute
    const computedRows: LanceDbRow[] = [];
    for await (const [progress, row, data] of this.computeChunks(
      results.compute,
      tagString
    )) {
      computedRows.push(row);

      // Add the computed rows to the cache
      await sqlite.run(
        "INSERT INTO lance_db_cache (uuid, cacheKey, path, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?)",
        row.uuid,
        row.cacheKey,
        row.path,
        JSON.stringify(row.vector),
        data.startLine,
        data.endLine,
        data.contents
      );

      yield progress;
    }

    // Create table if needed, add computed rows
    let table: lancedb.Table;
    if (existingTables.includes(tableName)) {
      table = await db.openTable(tableName);
      await table.add(computedRows);
    } else {
      table = await db.createTable(tableName, computedRows);
    }

    // Add tag - retrieve the computed info from lance sqlite cache
    for (let { path, cacheKey } of results.addTag) {
      const cachedItems = await sqlite.all(
        "SELECT * FROM lance_db_cache WHERE cacheKey = '?' AND path = '?'",
        cacheKey,
        path
      );

      const lanceRows: LanceDbRow[] = cachedItems.map((item) => {
        return {
          path,
          cacheKey,
          uuid: item.uuid,
          vector: JSON.parse(item.vector),
        };
      });

      await table.add(lanceRows);
    }

    // Delete or remove tag - remove from lance table
    for (let { path, cacheKey } of [...results.removeTag, ...results.del]) {
      await table.delete(`cacheKey = '${cacheKey}' AND path = '${path}'`);
    }

    // Delete - also remove from sqlite cache
    for (let { path, cacheKey } of results.del) {
      await sqlite.run(
        "DELETE FROM lance_db_cache WHERE cacheKey = '?' AND path = '?'",
        cacheKey,
        path
      );
    }

    yield 1;
  }
}
