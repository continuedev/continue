import { QdrantClient } from "@qdrant/js-client-rest";
import { RunResult } from "sqlite3";
import { v4 as uuidv4 } from "uuid";

import {
    BranchAndDir,
    Chunk,
    ILLM,
    IndexTag,
    IndexingProgressUpdate,
} from "../index";
import { migrate } from "../util/paths";
import { getUriPathBasename } from "../util/uri";

import { basicChunker } from "./chunk/basic.js";
import { chunkDocument, shouldChunk } from "./chunk/chunk.js";
import { DatabaseConnection, SqliteDb } from "./refreshIndex.js";
import {
    CodebaseIndex,
    IndexResultType,
    MarkCompleteCallback,
    PathAndCacheKey,
    RefreshIndexResults,
} from "./types";

import { tagToString } from "./utils";

export interface QdrantConfig {
  mode: "docker" | "cloud";
  url?: string; // For docker: server URL (defaults to http://localhost:6333)
  apiKey?: string; // For cloud: API key (required for cloud mode)
}

interface QdrantRow {
  uuid: string;
  path: string;
  cachekey: string;
  vector: number[];
  startLine: number;
  endLine: number;
  contents: string;
}

type ItemWithChunks = { item: PathAndCacheKey; chunks: Chunk[] };

type ChunkMap = Map<string, ItemWithChunks>;

export class QdrantIndex implements CodebaseIndex {
  private client: QdrantClient;
  private config: QdrantConfig;

  relativeExpectedTime: number = 13;
  get artifactId(): string {
    return `qdrant::${this.embeddingsProvider?.embeddingId}`;
  }

  /**
   * Factory method for creating QdrantIndex instances.
   *
   * Supports two modes:
   * - docker: Connects to Docker Qdrant instance (default: http://localhost:6333)
   * - cloud: Connects to Qdrant Cloud instance (requires url and apiKey)
   */
  static async create(
    embeddingsProvider: ILLM,
    readFile: (filepath: string) => Promise<string>,
    qdrantConfig: QdrantConfig,
  ): Promise<QdrantIndex | null> {
    try {
      let client: QdrantClient;

      if (qdrantConfig.mode === "cloud") {
        if (!qdrantConfig.url || !qdrantConfig.apiKey) {
          console.error(
            "Qdrant cloud mode requires url and apiKey configuration",
          );
          return null;
        }
        client = new QdrantClient({
          url: qdrantConfig.url,
          apiKey: qdrantConfig.apiKey,
        });
      } else {
        // docker mode (default)
        const url = qdrantConfig.url || "http://localhost:6333";
        client = new QdrantClient({ url });
      }

      // Test connection
      await client.getCollections();

      return new QdrantIndex(embeddingsProvider, readFile, client, qdrantConfig);
    } catch (err) {
      console.error("Failed to initialize Qdrant:", err);
      return null;
    }
  }

  private constructor(
    private readonly embeddingsProvider: ILLM,
    private readonly readFile: (filepath: string) => Promise<string>,
    client: QdrantClient,
    config: QdrantConfig,
  ) {
    this.client = client;
    this.config = config;
  }

  collectionNameForTag(tag: IndexTag) {
    return tagToString(tag).replace(/[^\w-_.]/g, "");
  }

  private async createSqliteCacheTable(db: DatabaseConnection) {
    await db.exec(`CREATE TABLE IF NOT EXISTS qdrant_db_cache (
        uuid TEXT PRIMARY KEY,
        cacheKey TEXT NOT NULL,
        path TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        vector TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        contents TEXT NOT NULL
    )`);

    await new Promise((resolve) => {
      void migrate(
        "qdrant_sqlite_artifact_id_column",
        async () => {
          try {
            const pragma = await db.all("PRAGMA table_info(qdrant_db_cache)");

            const hasArtifactIdCol = pragma.some(
              (pragma) => pragma.name === "artifact_id",
            );

            if (!hasArtifactIdCol) {
              await db.exec(
                "ALTER TABLE qdrant_db_cache ADD COLUMN artifact_id TEXT NOT NULL DEFAULT 'UNDEFINED'",
              );
            }
          } finally {
            resolve(undefined);
          }
        },
        () => resolve(undefined),
      );
    });
  }

  private async computeRows(items: PathAndCacheKey[]): Promise<QdrantRow[]> {
    const chunkMap = await this.collectChunks(items);
    const allChunks = Array.from(chunkMap.values()).flatMap(
      ({ chunks }) => chunks,
    );
    const embeddings = await this.getEmbeddings(allChunks);

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

    return this.createQdrantRows(chunkMap, embeddings);
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
        console.log(`QdrantIndex, skipping ${item.path}: ${err}`);
      }
    }

    return chunkMap;
  }

  private async getChunks(
    item: PathAndCacheKey,
    content: string,
  ): Promise<Chunk[]> {
    if (!this.embeddingsProvider) {
      return [];
    }
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
    if (!this.embeddingsProvider) {
      return [];
    }
    try {
      return await this.embeddingsProvider.embed(chunks.map((c) => c.content));
    } catch (err) {
      throw new Error(
        `Failed to generate embeddings for ${chunks.length} chunks with provider: ${this.embeddingsProvider.embeddingId}: ${err}`,
        { cause: err },
      );
    }
  }

  private createQdrantRows(
    chunkMap: ChunkMap,
    embeddings: number[][],
  ): QdrantRow[] {
    const results: QdrantRow[] = [];
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

  /**
   * Due to a bug in indexing, some indexes have vectors
   * without the surrounding []. These would fail to parse
   * but this allows such existing indexes to function properly
   */
  private parseVector(vector: string): number[] {
    try {
      return JSON.parse(vector);
    } catch (err) {
      try {
        return JSON.parse(`[${vector}]`);
      } catch (err2) {
        throw new Error(`Failed to parse vector: ${vector}`, { cause: err2 });
      }
    }
  }

  private async ensureCollection(
    collectionName: string,
    vectorSize: number,
  ): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (c) => c.name === collectionName,
      );

      if (!collectionExists) {
        await this.client.createCollection(collectionName, {
          vectors: {
            size: vectorSize,
            distance: "Cosine",
          },
        });
      }
    } catch (err) {
      console.error(`Failed to ensure collection ${collectionName}:`, err);
      throw err;
    }
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const sqliteDb = await SqliteDb.get();
    await this.createSqliteCacheTable(sqliteDb);

    const collectionName = this.collectionNameForTag(tag);

    yield {
      progress: 0,
      desc: `Computing embeddings for ${
        results.compute.length
      } ${this.formatListPlurality("file", results.compute.length)}`,
      status: "indexing",
    };

    const dbRows = await this.computeRows(results.compute);
    await this.insertRows(sqliteDb, dbRows);

    // Determine vector size from first embedding
    const vectorSize =
      dbRows.length > 0 && dbRows[0].vector.length > 0
        ? dbRows[0].vector.length
        : 1536; // Default fallback

    await this.ensureCollection(collectionName, vectorSize);

    // Upsert computed rows
    if (dbRows.length > 0) {
      const points = dbRows.map((row) => ({
        id: row.uuid,
        vector: row.vector,
        payload: {
          path: row.path,
          cachekey: row.cachekey,
          startLine: row.startLine,
          endLine: row.endLine,
          contents: row.contents,
        },
      }));

      try {
        await this.client.upsert(collectionName, {
          wait: true,
          points,
        });
      } catch (err) {
        console.error(`Failed to upsert points to ${collectionName}:`, err);
        throw err;
      }
    }

    await markComplete(results.compute, IndexResultType.Compute);
    let accumulatedProgress = 0;

    // Handle addTag - retrieve from cache and add to collection
    for (const { path, cacheKey } of results.addTag) {
      const stmt = await sqliteDb.prepare(
        "SELECT * FROM qdrant_db_cache WHERE cacheKey = ? AND artifact_id = ?",
        cacheKey,
        this.artifactId,
      );
      const cachedItems = await stmt.all();

      const qdrantPoints = [];
      for (const item of cachedItems) {
        try {
          const vector = this.parseVector(item.vector);
          const { uuid, startLine, endLine, contents } = item;

          qdrantPoints.push({
            id: uuid,
            vector,
            payload: {
              path,
              cachekey: cacheKey,
              startLine,
              endLine,
              contents,
            },
          });
        } catch (err) {
          console.warn(
            `QdrantIndex, skipping ${item.path} due to invalid vector JSON:\n${item.vector}\n\nError: ${err}`,
          );
        }
      }

      if (qdrantPoints.length > 0) {
        const vectorSize =
          qdrantPoints.length > 0 && qdrantPoints[0].vector.length > 0
            ? qdrantPoints[0].vector.length
            : 1536;
        await this.ensureCollection(collectionName, vectorSize);

        try {
          await this.client.upsert(collectionName, {
            wait: true,
            points: qdrantPoints,
          });
        } catch (err) {
          console.error(`Failed to upsert cached points:`, err);
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

    // Handle removeTag and del - delete from collection
    const toDel = [...results.removeTag, ...results.del];

    if (toDel.length > 0) {
      try {
        // Get UUIDs to delete from SQLite cache
        const deleteUuids: string[] = [];
        for (const { path, cacheKey } of toDel) {
          const stmt = await sqliteDb.prepare(
            "SELECT uuid FROM qdrant_db_cache WHERE cacheKey = ? AND path = ? AND artifact_id = ?",
            cacheKey,
            path,
            this.artifactId,
          );
          const items = await stmt.all();
          deleteUuids.push(...items.map((item) => item.uuid));
        }

        if (deleteUuids.length > 0) {
          await this.client.delete(collectionName, {
            wait: true,
            points: deleteUuids,
          });
        }
      } catch (err) {
        console.error(`Failed to delete points from ${collectionName}:`, err);
      }
    }

    await markComplete(results.removeTag, IndexResultType.RemoveTag);

    // Delete from SQLite cache
    for (const { path, cacheKey } of results.del) {
      await sqliteDb.run(
        "DELETE FROM qdrant_db_cache WHERE cacheKey = ? AND path = ? AND artifact_id = ?",
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
  ): Promise<Array<{ id: string; score: number; payload: any }>> {
    const collectionName = this.collectionNameForTag(tag);

    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (c) => c.name === collectionName,
      );

      if (!collectionExists) {
        console.warn("Collection not found in Qdrant", collectionName);
        return [];
      }

      // For directory filtering, we retrieve more results and filter client-side
      // since Qdrant doesn't have native LIKE/prefix matching
      const limit = directory ? Math.min(n * 10, 300) : n;
      
      const searchResult = await this.client.search(collectionName, {
        vector,
        limit: limit,
      });
      
      // Filter by directory prefix if specified
      const filteredResults = directory
        ? searchResult.filter(
            (result) =>
              result.payload &&
              typeof result.payload.path === "string" &&
              result.payload.path.startsWith(directory),
          )
        : searchResult;

      return filteredResults.slice(0, n).map((result) => ({
        id: result.id as string,
        score: result.score,
        payload: result.payload || {},
      }));
    } catch (err) {
      console.error(`Failed to search collection ${collectionName}:`, err);
      return [];
    }
  }

  async retrieve(
    query: string,
    n: number,
    tags: BranchAndDir[],
    filterDirectory: string | undefined,
  ): Promise<Chunk[]> {
    if (!this.embeddingsProvider) {
      return [];
    }

    // Use just the first chunk of the user query in case it is too long
    const chunks = [];
    for await (const chunk of basicChunker(
      query,
      this.embeddingsProvider.maxEmbeddingChunkSize,
    )) {
      chunks.push(chunk);
    }
    let vector = null;
    try {
      [vector] = await this.embeddingsProvider.embed(
        chunks.map((c) => c.content),
      );
    } catch (err) {
      // If we fail to chunk, we just use what was happening before.
      [vector] = await this.embeddingsProvider.embed([query]);
    }

    let allResults: Array<{ id: string; score: number; payload: any }> = [];
    for (const tag of tags) {
      const results = await this._retrieveForTag(
        { ...tag, artifactId: this.artifactId },
        n,
        filterDirectory,
        vector,
      );
      allResults.push(...results);
    }

    // Sort by score (higher is better for cosine similarity)
    allResults = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, n);

    const sqliteDb = await SqliteDb.get();
    const uuids = allResults.map((r) => `'${r.id}'`).join(",");
    if (!uuids) {
      return [];
    }

    const data = await sqliteDb.all(
      `SELECT * FROM qdrant_db_cache WHERE uuid in (${uuids})`,
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
    rows: QdrantRow[],
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      db.db.serialize(() => {
        db.db.exec("BEGIN", (err: Error | null) => {
          if (err) {
            reject(new Error("error creating transaction", { cause: err }));
          }
        });

        const sql =
          "INSERT INTO qdrant_db_cache (uuid, cacheKey, path, artifact_id, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
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
                  new Error("error inserting into qdrant_db_cache table", {
                    cause: err },
                  ),
                );
              }
            },
          );
        });
        db.db.exec("COMMIT", (err: Error | null) => {
          if (err) {
            reject(
              new Error(
                "error while committing insert into qdrant_db_rows transaction",
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

