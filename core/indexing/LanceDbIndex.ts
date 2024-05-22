// NOTE: vectordb requirement must be listed in extensions/vscode to avoid error
import { v4 as uuidv4 } from "uuid";
import { Table } from "vectordb";
import { IContinueServerClient } from "../continueServer/interface.js";
import {
  BranchAndDir,
  Chunk,
  EmbeddingsProvider,
  IndexTag,
  IndexingProgressUpdate,
} from "../index.js";
import { MAX_CHUNK_SIZE } from "../llm/constants.js";
import { getBasename } from "../util/index.js";
import { getLanceDbPath } from "../util/paths.js";
import { chunkDocument } from "./chunk/chunk.js";
import { DatabaseConnection, SqliteDb, tagToString } from "./refreshIndex.js";
import {
  CodebaseIndex,
  IndexResultType,
  PathAndCacheKey,
  RefreshIndexResults,
} from "./types.js";

// LanceDB  converts to lowercase, so names must all be lowercase
interface LanceDbRow {
  uuid: string;
  path: string;
  cachekey: string;
  vector: number[];
  [key: string]: any;
}

export class LanceDbIndex implements CodebaseIndex {
  get artifactId(): string {
    return "vectordb::" + this.embeddingsProvider.id;
  }

  static MAX_CHUNK_SIZE = MAX_CHUNK_SIZE;

  constructor(
    private readonly embeddingsProvider: EmbeddingsProvider,
    private readonly readFile: (filepath: string) => Promise<string>,
    private readonly continueServerClient?: IContinueServerClient,
  ) {}

  private tableNameForTag(tag: IndexTag) {
    return tagToString(tag).replace(/[^\w-_.]/g, "");
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
  ): AsyncGenerator<
    | [
        number,
        LanceDbRow,
        { startLine: number; endLine: number; contents: string },
        string,
      ]
    | PathAndCacheKey
  > {
    const contents = await Promise.all(
      items.map(({ path }) => this.readFile(path)),
    );

    for (let i = 0; i < items.length; i++) {
      // Break into chunks
      const content = contents[i];
      const chunks: Chunk[] = [];

      for await (let chunk of chunkDocument(
        items[i].path,
        content,
        LanceDbIndex.MAX_CHUNK_SIZE,
        items[i].cacheKey,
      )) {
        chunks.push(chunk);
      }

      if (chunks.length > 20) {
        // Too many chunks to index, probably a larger file than we want to include
        continue;
      }

      // Calculate embeddings
      const embeddings = await this.embeddingsProvider.embed(
        chunks.map((c) => c.content),
      );

      if (embeddings.some((emb) => emb === undefined)) {
        throw new Error(
          `Failed to generate embedding for ${chunks[0]?.filepath} with provider: ${this.embeddingsProvider.id}`,
        );
      }

      // Create row format
      for (let j = 0; j < chunks.length; j++) {
        const progress = (i + j / chunks.length) / items.length;
        const row = {
          vector: embeddings[j],
          path: items[i].path,
          cachekey: items[i].cacheKey,
          uuid: uuidv4(),
        };
        const chunk = chunks[j];
        yield [
          progress,
          row,
          {
            contents: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
          },
          `Indexing ${getBasename(chunks[j].filepath)}`,
        ];
      }

      yield items[i];
    }
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: (
      items: PathAndCacheKey[],
      resultType: IndexResultType,
    ) => void,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const lancedb = await import("vectordb");
    const tableName = this.tableNameForTag(tag);
    const db = await lancedb.connect(getLanceDbPath());

    const sqlite = await SqliteDb.get();
    await this.createSqliteCacheTable(sqlite);

    // Compute
    let table: Table<number[]> | undefined = undefined;
    let needToCreateTable = true;
    const existingTables = await db.tableNames();

    const addComputedLanceDbRows = async (
      pathAndCacheKey: PathAndCacheKey,
      computedRows: LanceDbRow[],
    ) => {
      // Create table if needed, add computed rows
      if (table) {
        if (computedRows.length > 0) {
          await table.add(computedRows);
        }
      } else if (existingTables.includes(tableName)) {
        table = await db.openTable(tableName);
        needToCreateTable = false;
        if (computedRows.length > 0) {
          await table.add(computedRows);
        }
      } else if (computedRows.length > 0) {
        table = await db.createTable(tableName, computedRows);
        needToCreateTable = false;
      }

      // Mark item complete
      markComplete([pathAndCacheKey], IndexResultType.Compute);
    };

    // Check remote cache
    if (this.continueServerClient?.connected) {
      try {
        const keys = results.compute.map(({ cacheKey }) => cacheKey);
        const resp = await this.continueServerClient.getFromIndexCache(
          keys,
          "embeddings",
          repoName,
        );
        for (const [cacheKey, chunks] of Object.entries(resp.files)) {
          // Get path for cacheKey
          const path = results.compute.find(
            (item) => item.cacheKey === cacheKey,
          )?.path;
          if (!path) {
            console.warn(
              "Continue server sent a cacheKey that wasn't requested",
              cacheKey,
            );
            continue;
          }

          // Build LanceDbRow objects
          const rows: LanceDbRow[] = [];
          for (const chunk of chunks) {
            const row = {
              path,
              cachekey: cacheKey,
              uuid: uuidv4(),
              vector: chunk.vector,
            };
            rows.push(row);

            await sqlite.run(
              "INSERT INTO lance_db_cache (uuid, cacheKey, path, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?)",
              row.uuid,
              row.cachekey,
              row.path,
              JSON.stringify(row.vector),
              chunk.startLine,
              chunk.endLine,
              chunk.contents,
            );
          }

          await addComputedLanceDbRows({ cacheKey, path }, rows);
        }

        // Remove items that don't need to be recomputed
        results.compute = results.compute.filter(
          (item) => !resp.files[item.cacheKey],
        );
      } catch (e) {
        console.log("Error checking remote cache: ", e);
      }
    }

    let computedRows: LanceDbRow[] = [];
    for await (const update of this.computeChunks(results.compute)) {
      if (Array.isArray(update)) {
        const [progress, row, data, desc] = update;
        computedRows.push(row);

        // Add the computed row to the cache
        await sqlite.run(
          "INSERT INTO lance_db_cache (uuid, cacheKey, path, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?)",
          row.uuid,
          row.cachekey,
          row.path,
          JSON.stringify(row.vector),
          data.startLine,
          data.endLine,
          data.contents,
        );

        yield { progress, desc, status: "indexing" };
      } else {
        await addComputedLanceDbRows(update, computedRows);
        computedRows = [];
      }
    }

    // Add tag - retrieve the computed info from lance sqlite cache
    for (let { path, cacheKey } of results.addTag) {
      const stmt = await sqlite.prepare(
        "SELECT * FROM lance_db_cache WHERE cacheKey = ? AND path = ?",
        cacheKey,
        path,
      );
      const cachedItems = await stmt.all();

      const lanceRows: LanceDbRow[] = cachedItems.map((item) => {
        return {
          path,
          cachekey: cacheKey,
          uuid: item.uuid,
          vector: JSON.parse(item.vector),
        };
      });

      if (needToCreateTable && lanceRows.length > 0) {
        table = await db.createTable(tableName, lanceRows);
        needToCreateTable = false;
      } else if (lanceRows.length > 0) {
        await table!.add(lanceRows);
      }

      markComplete([{ path, cacheKey }], IndexResultType.AddTag);
    }

    // Delete or remove tag - remove from lance table)
    if (!needToCreateTable) {
      for (let { path, cacheKey } of [...results.removeTag, ...results.del]) {
        // This is where the aforementioned lowercase conversion problem shows
        await table!.delete(`cachekey = '${cacheKey}' AND path = '${path}'`);
      }
    }
    markComplete(results.removeTag, IndexResultType.RemoveTag);

    // Delete - also remove from sqlite cache
    for (let { path, cacheKey } of results.del) {
      await sqlite.run(
        "DELETE FROM lance_db_cache WHERE cacheKey = ? AND path = ?",
        cacheKey,
        path,
      );
    }

    markComplete(results.del, IndexResultType.Delete);
    yield {
      progress: 1,
      desc: "Completed Calculating Embeddings",
      status: "done",
    };
  }

  private async _retrieveForTag(
    tag: IndexTag,
    n: number,
    directory: string | undefined,
    vector: number[],
    db: any, /// lancedb.Connection
  ): Promise<LanceDbRow[]> {
    const tableName = this.tableNameForTag(tag);
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      console.warn("Table not found in LanceDB", tableName);
      return [];
    }

    const table = await db.openTable(tableName);
    let query = table.search(vector);
    if (directory) {
      // seems like lancedb is only post-filtering, so have to return a bunch of results and slice after
      query = query.where(`path LIKE '${directory}%'`).limit(300);
    } else {
      query = query.limit(n);
    }
    const results = await query.execute();
    return results.slice(0, n) as any;
  }

  async retrieve(
    query: string,
    n: number,
    tags: BranchAndDir[],
    filterDirectory: string | undefined,
  ): Promise<Chunk[]> {
    const lancedb = await import("vectordb");
    if (!lancedb.connect) {
      throw new Error("LanceDB failed to load a native module");
    }
    const [vector] = await this.embeddingsProvider.embed([query]);
    const db = await lancedb.connect(getLanceDbPath());

    let allResults = [];
    for (const tag of tags) {
      const results = await this._retrieveForTag(
        { ...tag, artifactId: this.artifactId },
        n,
        filterDirectory,
        vector,
        db,
      );
      allResults.push(...results);
    }

    allResults = allResults
      .sort((a, b) => a._distance - b._distance)
      .slice(0, n);

    const sqliteDb = await SqliteDb.get();
    const data = await sqliteDb.all(
      `SELECT * FROM lance_db_cache WHERE uuid in (${allResults
        .map((r) => `'${r.uuid}'`)
        .join(",")})`,
    );

    return data.map((d) => {
      return {
        digest: d.cacheKey,
        filepath: d.path,
        startLine: d.startLine,
        endLine: d.endLine,
        index: 0,
        content: d.contents,
      };
    });
  }
}
