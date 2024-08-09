// NOTE: vectordb requirement must be listed in extensions/vscode to avoid error
import { RunResult } from "sqlite3";
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
import { getBasename } from "../util/index.js";
import { getLanceDbPath, migrate } from "../util/paths.js";
import { chunkDocument, shouldChunk } from "./chunk/chunk.js";
import { DatabaseConnection, SqliteDb, tagToString } from "./refreshIndex.js";
import {
  CodebaseIndex,
  IndexResultType,
  MarkCompleteCallback,
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
  relativeExpectedTime: number = 13;
  get artifactId(): string {
    return `vectordb::${this.embeddingsProvider.id}`;
  }

  constructor(
    private readonly embeddingsProvider: EmbeddingsProvider,
    private readonly readFile: (filepath: string) => Promise<string>,
    private readonly pathSep: string,
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
        artifact_id TEXT NOT NULL,
        vector TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        contents TEXT NOT NULL
    )`);

    await new Promise((resolve) =>
      migrate(
        "lancedb_sqlite_artifact_id_column",
        async () => {
          try {
            const pragma = await db.all("PRAGMA table_info(lance_db_cache)");

            const hasArtifactIdCol = pragma.some(
              (pragma) => pragma.name === "artifact_id",
            );

            if (!hasArtifactIdCol) {
              await db.exec(
                "ALTER TABLE lance_db_cache ADD COLUMN artifact_id TEXT NOT NULL DEFAULT 'UNDEFINED'",
              );
            }
          } finally {
            resolve(undefined);
          }
        },
        () => resolve(undefined),
      ),
    );
  }

  private async packToRows(item: PathAndCacheKey): Promise<LanceDbRow[]> {
    const content = await this.readFile(item.path);
    if (!shouldChunk(this.pathSep, item.path, content)) {
      return [];
    }
    const chunks: Chunk[] = [];
    const chunkParams = {
      filepath: item.path,
      contents: content,
      maxChunkSize: this.embeddingsProvider.maxChunkSize,
      digest: item.cacheKey,
    };
    for await (const chunk of chunkDocument(chunkParams)) {
      if (chunk.content.length === 0) {
        // File did not chunk properly, let's skip it.
        throw new Error("did not chunk properly");
      }
      chunks.push(chunk);
    }
    const embeddings = await this.chunkListToEmbedding(chunks);
    if (chunks.length !== embeddings.length) {
      throw new Error(
        `Unexpected lengths: chunks and embeddings do not match for ${item.path}`,
      );
    }
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      results.push({
        path: item.path,
        cachekey: item.cacheKey,
        uuid: uuidv4(),
        vector: embeddings[i],
        startLine: chunks[i].startLine,
        endLine: chunks[i].endLine,
        contents: chunks[i].content,
      });
    }
    return results;
  }

  private async chunkListToEmbedding(chunks: Chunk[]): Promise<number[][]> {
    let embeddings: number[][];
    try {
      embeddings = await this.embeddingsProvider.embed(
        chunks.map((c) => c.content),
      );
    } catch (err) {
      throw new Error(
        `Failed to generate embedding for ${chunks[0]?.filepath} with provider: ${this.embeddingsProvider.id}: ${err}`,
        { cause: err },
      );
    }
    if (embeddings.some((emb) => emb === undefined)) {
      throw new Error(
        `Empty embedding returned for ${chunks[0]?.filepath} with provider: ${this.embeddingsProvider.id}`,
      );
    }
    return embeddings;
  }

  private async computeRows(items: PathAndCacheKey[]): Promise<LanceDbRow[]> {
    const rowChunkPromises = items.map(this.packToRows.bind(this));
    const rowChunkLists = [];
    for (let i = 0; i < items.length; i++) {
      try {
        rowChunkLists.push(await rowChunkPromises[i]);
      } catch (err) {
        console.log(`LanceDBIndex, skipping ${items[i].path}: ${err}`);
      }
    }
    return rowChunkLists.flat();
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const lancedb = await import("vectordb");
    const tableName = this.tableNameForTag(tag);
    const db = await lancedb.connect(getLanceDbPath());

    const sqlite = await SqliteDb.get();
    await this.createSqliteCacheTable(sqlite);

    // Compute
    let table: Table<number[]> | undefined = undefined;
    const existingTables = await db.tableNames();
    let needToCreateTable = !existingTables.includes(tableName);

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
      await markComplete([pathAndCacheKey], IndexResultType.Compute);
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
              "INSERT INTO lance_db_cache (uuid, cacheKey, path, artifact_id, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              row.uuid,
              row.cachekey,
              row.path,
              this.artifactId,
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

    yield {
      progress: 0,
      desc: `Computing embeddings for ${
        results.compute.length
      } ${this.formatListPlurality("file", results.compute.length)}`,
      status: "indexing",
    };

    const dbRows = await this.computeRows(results.compute);
    await this.insertRows(sqlite, dbRows);
    await Promise.all(
      results.compute.map((item) => {
        addComputedLanceDbRows(
          item,
          dbRows.filter((row) => row.path === item.path),
        );
      }),
    );
    await markComplete(results.compute, IndexResultType.Compute);
    let accumulatedProgress = 0;

    // Add tag - retrieve the computed info from lance sqlite cache
    for (const { path, cacheKey } of results.addTag) {
      const stmt = await sqlite.prepare(
        "SELECT * FROM lance_db_cache WHERE cacheKey = ? AND path = ? AND artifact_id = ?",
        cacheKey,
        path,
        this.artifactId,
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

      if (lanceRows.length > 0) {
        if (needToCreateTable) {
          table = await db.createTable(tableName, lanceRows);
          needToCreateTable = false;
        } else if (!table) {
          table = await db.openTable(tableName);
          needToCreateTable = false;
          await table.add(lanceRows);
        } else {
          await table?.add(lanceRows);
        }
      }

      await markComplete([{ path, cacheKey }], IndexResultType.AddTag);
      accumulatedProgress += 1 / results.addTag.length / 3;
      yield {
        progress: accumulatedProgress,
        desc: `Indexing ${getBasename(path)}`,
        status: "indexing",
      };
    }

    // Delete or remove tag - remove from lance table)
    if (!needToCreateTable) {
      const toDel = [...results.removeTag, ...results.del];
      for (const { path, cacheKey } of toDel) {
        // This is where the aforementioned lowercase conversion problem shows
        await table?.delete(`cachekey = '${cacheKey}' AND path = '${path}'`);

        accumulatedProgress += 1 / toDel.length / 3;
        yield {
          progress: accumulatedProgress,
          desc: `Stashing ${getBasename(path)}`,
          status: "indexing",
        };
      }
    }
    await markComplete(results.removeTag, IndexResultType.RemoveTag);

    // Delete - also remove from sqlite cache
    for (const { path, cacheKey } of results.del) {
      await sqlite.run(
        "DELETE FROM lance_db_cache WHERE cacheKey = ? AND path = ? AND artifact_id = ?",
        cacheKey,
        path,
        this.artifactId,
      );
      accumulatedProgress += 1 / results.del.length / 3;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getBasename(path)}`,
        status: "indexing",
      };
    }

    await markComplete(results.del, IndexResultType.Delete);
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

  private async insertRows(
    db: DatabaseConnection,
    rows: LanceDbRow[],
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      db.db.serialize(() => {
        db.db.exec("BEGIN", (err: Error | null) => {
          if (err) {
            reject(new Error("error creating transaction", { cause: err }));
          }
        });

        const sql =
          "INSERT INTO lance_db_cache (uuid, cacheKey, path, artifact_id, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        rows.map((r) => {
          db.db.run(
            sql,
            [
              r.uuid,
              r.cachekey,
              r.path,
              this.artifactId,
              JSON.stringify(r.vector),
              r.startLine,
              r.endLine,
              r.contents,
            ],
            (result: RunResult, err: Error) => {
              if (err) {
                reject(
                  new Error("error inserting into lance_db_cache table", {
                    cause: err,
                  }),
                );
              }
            },
          );
        });
        db.db.exec("COMMIT", (err: Error | null) => {
          if (err) {
            reject(
              new Error(
                "error while committing insert into lance_db_rows transaction",
                { cause: err },
              ),
            );
          }
        });
        resolve();
      });
    });
  }

  private formatListPlurality(word: string, length: number): string {
    return length <= 1 ? word : `${word}s`;
  }
}
