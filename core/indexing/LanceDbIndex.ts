// NOTE: vectordb requirement must be listed in extensions/vscode to avoid error
import { RunResult } from "sqlite3";
import { v4 as uuidv4 } from "uuid";
import lance, { Table } from "vectordb";

import { IContinueServerClient } from "../continueServer/interface.js";
import {
  BranchAndDir,
  Chunk,
  ILLM,
  IndexTag,
  IndexingProgressUpdate,
} from "../index.js";
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
import { getUriPathBasename } from "../util/uri.js";

// LanceDB  converts to lowercase, so names must all be lowercase
interface LanceDbRow {
  uuid: string;
  path: string;
  cachekey: string;
  vector: number[];
  [key: string]: any;
}

type ItemWithChunks = { item: PathAndCacheKey; chunks: Chunk[] };

type ChunkMap = Map<string, ItemWithChunks>;

export class LanceDbIndex implements CodebaseIndex {
  relativeExpectedTime: number = 13;
  get artifactId(): string {
    return `vectordb::${this.embeddingsProvider.embeddingId}`;
  }

  constructor(
    private readonly embeddingsProvider: ILLM,
    private readonly readFile: (filepath: string) => Promise<string>,
    private readonly continueServerClient?: IContinueServerClient,
  ) {}

  tableNameForTag(tag: IndexTag) {
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

  private async computeRows(items: PathAndCacheKey[]): Promise<LanceDbRow[]> {
    const chunkMap = await this.collectChunks(items);
    const allChunks = Array.from(chunkMap.values()).flatMap(
      ({ chunks }) => chunks,
    );
    const embeddings = await this.getEmbeddings(allChunks);

    // Remove undefined embeddings and their corresponding chunks
    for (let i = embeddings.length - 1; i >= 0; i--) {
      if (embeddings[i] === undefined) {
        const chunk = allChunks[i];
        const chunks = chunkMap.get(chunk.filepath)?.chunks;

        if (chunks) {
          const index = chunks.findIndex((c) => c === chunk);
          if (index !== -1) {
            chunks.splice(index, 1);
          }
        }

        embeddings.splice(i, 1);
      }
    }

    return this.createLanceDbRows(chunkMap, embeddings);
  }

  private async collectChunks(items: PathAndCacheKey[]): Promise<ChunkMap> {
    const chunkMap: ChunkMap = new Map();

    for (const item of items) {
      try {
        const content = await this.readFile(item.path);

        if (!shouldChunk(item.path, content)) {
          continue;
        }

        const chunks = await this.getChunks(item, content);
        chunkMap.set(item.path, { item, chunks });
      } catch (err) {
        console.log(`LanceDBIndex, skipping ${item.path}: ${err}`);
      }
    }

    return chunkMap;
  }

  private async getChunks(
    item: PathAndCacheKey,
    content: string,
  ): Promise<Chunk[]> {
    const chunks: Chunk[] = [];

    const chunkParams = {
      filepath: item.path,
      contents: content,
      maxChunkSize: this.embeddingsProvider.maxEmbeddingChunkSize,
      digest: item.cacheKey,
    };

    for await (const chunk of chunkDocument(chunkParams)) {
      if (chunk.content.length === 0) {
        throw new Error("did not chunk properly");
      }

      chunks.push(chunk);
    }

    return chunks;
  }

  private async getEmbeddings(chunks: Chunk[]): Promise<number[][]> {
    try {
      return await this.embeddingsProvider.embed(chunks.map((c) => c.content));
    } catch (err) {
      throw new Error(
        `Failed to generate embeddings for ${chunks.length} chunks with provider: ${this.embeddingsProvider.embeddingId}: ${err}`,
        { cause: err },
      );
    }
  }

  private createLanceDbRows(
    chunkMap: ChunkMap,
    embeddings: number[][],
  ): LanceDbRow[] {
    const results: LanceDbRow[] = [];
    let embeddingIndex = 0;

    for (const [path, { item, chunks }] of chunkMap) {
      for (const chunk of chunks) {
        results.push({
          path,
          cachekey: item.cacheKey,
          uuid: uuidv4(),
          vector: embeddings[embeddingIndex],
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          contents: chunk.content,
        });
        embeddingIndex++;
      }
    }

    return results;
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const sqliteDb = await SqliteDb.get();
    await this.createSqliteCacheTable(sqliteDb);

    const lanceTableName = this.tableNameForTag(tag);
    const lanceDb = await lance.connect(getLanceDbPath());
    const existingLanceTables = await lanceDb.tableNames();

    let lanceTable: Table<number[]> | undefined = undefined;
    let needToCreateLanceTable = !existingLanceTables.includes(lanceTableName);

    // Compute
    const addComputedLanceDbRows = async (
      pathAndCacheKeys: PathAndCacheKey[],
      computedRows: LanceDbRow[],
    ) => {
      // Create table if needed, add computed rows
      if (lanceTable) {
        if (computedRows.length > 0) {
          await lanceTable.add(computedRows);
        }
      } else if (existingLanceTables.includes(lanceTableName)) {
        lanceTable = await lanceDb.openTable(lanceTableName);
        needToCreateLanceTable = false;
        if (computedRows.length > 0) {
          await lanceTable.add(computedRows);
        }
      } else if (computedRows.length > 0) {
        lanceTable = await lanceDb.createTable(lanceTableName, computedRows);
        needToCreateLanceTable = false;
      }

      // Mark item complete
      await markComplete(pathAndCacheKeys, IndexResultType.Compute);
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

            await sqliteDb.run(
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

          await addComputedLanceDbRows([{ cacheKey, path }], rows);
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
    await this.insertRows(sqliteDb, dbRows);
    await addComputedLanceDbRows(results.compute, dbRows);
    let accumulatedProgress = 0;

    // Add tag - retrieve the computed info from lance sqlite cache
    for (const { path, cacheKey } of results.addTag) {
      const stmt = await sqliteDb.prepare(
        "SELECT * FROM lance_db_cache WHERE cacheKey = ? AND artifact_id = ?",
        cacheKey,
        this.artifactId,
      );
      const cachedItems = await stmt.all();

      const lanceRows: LanceDbRow[] = cachedItems.map(
        ({ uuid, vector, startLine, endLine, contents }) => ({
          path,
          uuid,
          startLine,
          endLine,
          contents,
          cachekey: cacheKey,
          vector: JSON.parse(vector),
        }),
      );

      if (lanceRows.length > 0) {
        if (needToCreateLanceTable) {
          lanceTable = await lanceDb.createTable(lanceTableName, lanceRows);
          needToCreateLanceTable = false;
        } else if (!lanceTable) {
          lanceTable = await lanceDb.openTable(lanceTableName);
          needToCreateLanceTable = false;
          await lanceTable.add(lanceRows);
        } else {
          await lanceTable?.add(lanceRows);
        }
      }

      await markComplete([{ path, cacheKey }], IndexResultType.AddTag);
      accumulatedProgress += 1 / results.addTag.length / 3;
      yield {
        progress: accumulatedProgress,
        desc: `Indexing ${getUriPathBasename(path)}`,
        status: "indexing",
      };
    }

    // Delete or remove tag - remove from lance table)
    if (!needToCreateLanceTable) {
      const toDel = [...results.removeTag, ...results.del];

      if (!lanceTable) {
        lanceTable = await lanceDb.openTable(lanceTableName);
      }

      for (const { path, cacheKey } of toDel) {
        // This is where the aforementioned lowercase conversion problem shows
        await lanceTable.delete(
          `cachekey = '${cacheKey}' AND path = '${path}'`,
        );

        accumulatedProgress += 1 / toDel.length / 3;
        yield {
          progress: accumulatedProgress,
          desc: `Stashing ${getUriPathBasename(path)}`,
          status: "indexing",
        };
      }
    }

    await markComplete(results.removeTag, IndexResultType.RemoveTag);

    // Delete - also remove from sqlite cache
    for (const { path, cacheKey } of results.del) {
      await sqliteDb.run(
        "DELETE FROM lance_db_cache WHERE cacheKey = ? AND path = ? AND artifact_id = ?",
        cacheKey,
        path,
        this.artifactId,
      );
      accumulatedProgress += 1 / results.del.length / 3;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getUriPathBasename(path)}`,
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
    const [vector] = await this.embeddingsProvider.embed([query]);
    const db = await lance.connect(getLanceDbPath());

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
          } else {
            resolve();
          }
        });
      });
    });
  }

  private formatListPlurality(word: string, length: number): string {
    return length <= 1 ? word : `${word}s`;
  }
}
