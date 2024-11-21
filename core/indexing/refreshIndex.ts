import crypto from "node:crypto";
import * as fs from "node:fs";

import plimit from "p-limit";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

import { IndexTag, IndexingProgressUpdate } from "../index.js";
import { getIndexSqlitePath } from "../util/paths.js";

import {
  CodebaseIndex,
  IndexResultType,
  LastModifiedMap,
  MarkCompleteCallback,
  PathAndCacheKey,
  RefreshIndexResults,
} from "./types.js";

export type DatabaseConnection = Database<sqlite3.Database>;

export function tagToString(tag: IndexTag): string {
  return `${tag.directory}::${tag.branch}::${tag.artifactId}`;
}

export class SqliteDb {
  static db: DatabaseConnection | null = null;

  private static async createTables(db: DatabaseConnection) {
    await db.exec("PRAGMA journal_mode=WAL;");

    await db.exec(
      `CREATE TABLE IF NOT EXISTS tag_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dir STRING NOT NULL,
            branch STRING NOT NULL,
            artifactId STRING NOT NULL,
            path STRING NOT NULL,
            cacheKey STRING NOT NULL,
            lastUpdated INTEGER NOT NULL
        )`,
    );

    await db.exec(
      `CREATE TABLE IF NOT EXISTS global_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cacheKey STRING NOT NULL,
            dir STRING NOT NULL,
            branch STRING NOT NULL,
            artifactId STRING NOT NULL
        )`,
    );
    // Delete duplicate rows from tag_catalog
    await db.exec(`
    DELETE FROM tag_catalog
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM tag_catalog
      GROUP BY dir, branch, artifactId, path, cacheKey
    )
  `);

    // Delete duplicate rows from global_cache
    await db.exec(`
    DELETE FROM global_cache
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM global_cache
      GROUP BY cacheKey, dir, branch, artifactId
    )
  `);

    // Add unique constraints if they don't exist
    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_catalog_unique 
     ON tag_catalog(dir, branch, artifactId, path, cacheKey)`,
    );

    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_global_cache_unique 
     ON global_cache(cacheKey, dir, branch, artifactId)`,
    );
  }

  private static indexSqlitePath = getIndexSqlitePath();

  static async get() {
    if (SqliteDb.db && fs.existsSync(SqliteDb.indexSqlitePath)) {
      return SqliteDb.db;
    }

    SqliteDb.indexSqlitePath = getIndexSqlitePath();
    SqliteDb.db = await open({
      filename: SqliteDb.indexSqlitePath,
      driver: sqlite3.Database,
    });

    await SqliteDb.db.exec("PRAGMA busy_timeout = 3000;");

    await SqliteDb.createTables(SqliteDb.db);

    return SqliteDb.db;
  }
}

async function getSavedItemsForTag(
  tag: IndexTag,
): Promise<{ path: string; cacheKey: string; lastUpdated: number }[]> {
  const db = await SqliteDb.get();
  const stmt = await db.prepare(
    `SELECT path, cacheKey, lastUpdated FROM tag_catalog
    WHERE dir = ? AND branch = ? AND artifactId = ?`,
    tag.directory,
    tag.branch,
    tag.artifactId,
  );
  const rows = await stmt.all();
  return rows;
}

enum AddRemoveResultType {
  Add = "add",
  Remove = "remove",
  UpdateNewVersion = "updateNewVersion",
  UpdateOldVersion = "updateOldVersion",
  UpdateLastUpdated = "updateLastUpdated",
  Compute = "compute",
}

async function getAddRemoveForTag(
  tag: IndexTag,
  currentFiles: LastModifiedMap,
  readFile: (path: string) => Promise<string>,
): Promise<
  [
    PathAndCacheKey[],
    PathAndCacheKey[],
    PathAndCacheKey[],
    MarkCompleteCallback,
  ]
> {
  const newLastUpdatedTimestamp = Date.now();
  const files = { ...currentFiles };

  const saved = await getSavedItemsForTag(tag);

  const updateNewVersion: PathAndCacheKey[] = [];
  const updateOldVersion: PathAndCacheKey[] = [];
  const remove: PathAndCacheKey[] = [];
  const updateLastUpdated: PathAndCacheKey[] = [];

  for (const item of saved) {
    const { lastUpdated, ...pathAndCacheKey } = item;

    if (files[item.path] === undefined) {
      // Was indexed, but no longer exists. Remove
      remove.push(pathAndCacheKey);
    } else {
      // Exists in old and new, so determine whether it was updated
      if (lastUpdated < files[item.path]) {
        // Change was made after last update
        const newHash = calculateHash(await readFile(pathAndCacheKey.path));
        if (pathAndCacheKey.cacheKey !== newHash) {
          updateNewVersion.push({
            path: pathAndCacheKey.path,
            cacheKey: newHash,
          });
          updateOldVersion.push(pathAndCacheKey);
        } else {
          updateLastUpdated.push(pathAndCacheKey);
        }
      } else {
        // Already updated, do nothing
      }

      // Remove so we can check leftovers afterward
      delete files[item.path];
    }
  }

  // limit to only 10 concurrent file reads to avoid issues such as
  // "too many file handles". A large number here does not improve
  // throughput due to the nature of disk or network i/o -- huge
  // amounts of readers generally does not improve performance
  const limit = plimit(10);
  const promises = Object.keys(files).map(async (path) => {
    const fileContents = await limit(() => readFile(path));
    return { path, cacheKey: calculateHash(fileContents) };
  });
  const add: PathAndCacheKey[] = await Promise.all(promises);

  // Create the markComplete callback function
  const db = await SqliteDb.get();
  const itemToAction: {
    [key in AddRemoveResultType]: PathAndCacheKey[];
  } = {
    [AddRemoveResultType.Add]: [],
    [AddRemoveResultType.Remove]: [],
    [AddRemoveResultType.UpdateNewVersion]: [],
    [AddRemoveResultType.UpdateOldVersion]: [],
    [AddRemoveResultType.UpdateLastUpdated]: [],
    [AddRemoveResultType.Compute]: [],
  };

  async function markComplete(
    items: PathAndCacheKey[],
    resultType: IndexResultType,
  ) {
    const addRemoveResultType =
      mapIndexResultTypeToAddRemoveResultType(resultType);

    const actionItems = itemToAction[addRemoveResultType];
    if (!actionItems) {
      console.warn(`No action items found for result type: ${resultType}`);
      return;
    }

    for (const item of items) {
      const { path, cacheKey } = item;
      switch (addRemoveResultType) {
        case AddRemoveResultType.Compute:
          await db.run(
            "REPLACE INTO tag_catalog (path, cacheKey, lastUpdated, dir, branch, artifactId) VALUES (?, ?, ?, ?, ?, ?)",
            path,
            cacheKey,
            newLastUpdatedTimestamp,
            tag.directory,
            tag.branch,
            tag.artifactId,
          );
          break;
        case AddRemoveResultType.Add:
          await db.run(
            "REPLACE INTO tag_catalog (path, cacheKey, lastUpdated, dir, branch, artifactId) VALUES (?, ?, ?, ?, ?, ?)",
            path,
            cacheKey,
            newLastUpdatedTimestamp,
            tag.directory,
            tag.branch,
            tag.artifactId,
          );
          break;
        case AddRemoveResultType.Remove:
          await db.run(
            `DELETE FROM tag_catalog WHERE
              cacheKey = ? AND
              path = ? AND
              dir = ? AND
              branch = ? AND
              artifactId = ?
          `,
            cacheKey,
            path,
            tag.directory,
            tag.branch,
            tag.artifactId,
          );
          break;
        case AddRemoveResultType.UpdateLastUpdated:
        case AddRemoveResultType.UpdateNewVersion:
          await db.run(
            `UPDATE tag_catalog SET
                cacheKey = ?,
                lastUpdated = ?
             WHERE
                path = ? AND
                dir = ? AND
                branch = ? AND
                artifactId = ?
            `,
            cacheKey,
            newLastUpdatedTimestamp,
            path,
            tag.directory,
            tag.branch,
            tag.artifactId,
          );
          break;
        case AddRemoveResultType.UpdateOldVersion:
          break;
      }
    }
  }

  for (const item of updateNewVersion) {
    itemToAction[AddRemoveResultType.UpdateNewVersion].push(item);
  }
  for (const item of add) {
    itemToAction[AddRemoveResultType.Add].push(item);
  }
  for (const item of updateOldVersion) {
    itemToAction[AddRemoveResultType.UpdateOldVersion].push(item);
  }
  for (const item of remove) {
    itemToAction[AddRemoveResultType.Remove].push(item);
  }

  return [
    [...add, ...updateNewVersion],
    [...remove, ...updateOldVersion],
    updateLastUpdated,
    markComplete,
  ];
}

/**
 * Check the global cache for items with this cacheKey for the given artifactId.
 * Return all of the tags that it exists under, which could be an empty array
 */
async function getTagsFromGlobalCache(
  cacheKey: string,
  artifactId: string,
): Promise<IndexTag[]> {
  const db = await SqliteDb.get();
  const stmt = await db.prepare(
    "SELECT dir, branch, artifactId FROM global_cache WHERE cacheKey = ? AND artifactId = ?",
  );
  const rows = await stmt.all(cacheKey, artifactId);
  return rows;
}

function calculateHash(fileContents: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fileContents);
  return hash.digest("hex");
}

function mapIndexResultTypeToAddRemoveResultType(
  resultType: IndexResultType,
): AddRemoveResultType {
  switch (resultType) {
    case "updateLastUpdated":
      return AddRemoveResultType.UpdateLastUpdated;
    case "compute":
      return AddRemoveResultType.Compute;
    case "addTag":
      return AddRemoveResultType.Add;
    case "del":
    case "removeTag":
      return AddRemoveResultType.Remove;
    default:
      throw new Error(`Unexpected result type: ${resultType}`);
  }
}

export async function getComputeDeleteAddRemove(
  tag: IndexTag,
  currentFiles: LastModifiedMap,
  readFile: (path: string) => Promise<string>,
  repoName: string | undefined,
): Promise<[RefreshIndexResults, PathAndCacheKey[], MarkCompleteCallback]> {
  const [add, remove, lastUpdated, markComplete] = await getAddRemoveForTag(
    tag,
    currentFiles,
    readFile,
  );

  const compute: PathAndCacheKey[] = [];
  const del: PathAndCacheKey[] = [];
  const addTag: PathAndCacheKey[] = [];
  const removeTag: PathAndCacheKey[] = [];

  for (const { path, cacheKey } of add) {
    const existingTags = await getTagsFromGlobalCache(cacheKey, tag.artifactId);
    if (existingTags.length > 0) {
      addTag.push({ path, cacheKey });
    } else {
      compute.push({ path, cacheKey });
    }
  }

  for (const { path, cacheKey } of remove) {
    const existingTags = await getTagsFromGlobalCache(cacheKey, tag.artifactId);
    if (existingTags.length > 1) {
      removeTag.push({ path, cacheKey });
    } else {
      if (existingTags.length === 0) {
        // console.warn("Existing tags should not be empty when trying to remove");
      }

      del.push({ path, cacheKey });
    }
  }

  const results = {
    compute,
    del,
    addTag,
    removeTag,
  };

  const globalCacheIndex = await GlobalCacheCodeBaseIndex.create();

  return [
    results,
    lastUpdated,
    async (items, resultType) => {
      // Update tag catalog
      await markComplete(items, resultType);

      // Update the global cache
      const results: any = {
        compute: [],
        del: [],
        addTag: [],
        removeTag: [],
      };
      results[resultType] = items;
      for await (const _ of globalCacheIndex.update(
        tag,
        results,
        async () => {},
        repoName,
      )) {
      }
    },
  ];
}

export class GlobalCacheCodeBaseIndex implements CodebaseIndex {
  relativeExpectedTime: number = 1;

  constructor(private db: DatabaseConnection) {}

  artifactId = "globalCache";

  static async create(): Promise<GlobalCacheCodeBaseIndex> {
    return new GlobalCacheCodeBaseIndex(await SqliteDb.get());
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    _: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const add = [...results.compute, ...results.addTag];
    const remove = [...results.del, ...results.removeTag];
    await Promise.all([
      ...remove.map(({ cacheKey }) => {
        return this.deleteOrRemoveTag(cacheKey, tag);
      }),
      ...add.map(({ cacheKey }) => {
        return this.computeOrAddTag(cacheKey, tag);
      }),
    ]);
    yield { progress: 1, desc: "Done updating global cache", status: "done" };
  }

  private async computeOrAddTag(
    cacheKey: string,
    tag: IndexTag,
  ): Promise<void> {
    await this.db.run(
      "REPLACE INTO global_cache (cacheKey, dir, branch, artifactId) VALUES (?, ?, ?, ?)",
      cacheKey,
      tag.directory,
      tag.branch,
      tag.artifactId,
    );
  }
  private async deleteOrRemoveTag(
    cacheKey: string,
    tag: IndexTag,
  ): Promise<void> {
    await this.db.run(
      "DELETE FROM global_cache WHERE cacheKey = ? AND dir = ? AND branch = ? AND artifactId = ?",
      cacheKey,
      tag.directory,
      tag.branch,
      tag.artifactId,
    );
  }
}

const SQLITE_MAX_LIKE_PATTERN_LENGTH = 50000;

export function truncateToLastNBytes(input: string, maxBytes: number): string {
  let bytes = 0;
  let startIndex = 0;

  for (let i = input.length - 1; i >= 0; i--) {
    bytes += new TextEncoder().encode(input[i]).length;
    if (bytes > maxBytes) {
      startIndex = i + 1;
      break;
    }
  }

  return input.substring(startIndex, input.length);
}

export function truncateSqliteLikePattern(input: string) {
  return truncateToLastNBytes(input, SQLITE_MAX_LIKE_PATTERN_LENGTH);
}
