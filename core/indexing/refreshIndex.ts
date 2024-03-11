import crypto from "crypto";
import * as fs from "fs";
import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";
import { IndexingProgressUpdate } from "..";
import { getIndexSqlitePath } from "../util/paths";
import {
  CodebaseIndex,
  IndexResultType,
  IndexTag,
  LastModifiedMap,
  MarkCompleteCallback,
  PathAndCacheKey,
  RefreshIndexResults,
} from "./types";

export type DatabaseConnection = Database<sqlite3.Database>;

export function tagToString(tag: IndexTag): string {
  return `${tag.directory}::${tag.branch}::${tag.artifactId}`;
}

export class SqliteDb {
  static db: DatabaseConnection | null = null;

  private static async createTables(db: DatabaseConnection) {
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

interface PathAndOptionalCacheKey {
  path: string;
  cacheKey?: string;
}

enum AddRemoveResultType {
  Add = "add",
  Remove = "remove",
  UpdateNewVersion = "updateNewVersion",
  UpdateOldVersion = "updateOldVersion",
}

async function getAddRemoveForTag(
  tag: IndexTag,
  currentFiles: LastModifiedMap,
  readFile: (path: string) => Promise<string>,
): Promise<[PathAndCacheKey[], PathAndCacheKey[], MarkCompleteCallback]> {
  const newLastUpdatedTimestamp = Date.now();

  const saved = await getSavedItemsForTag(tag);

  const add: PathAndCacheKey[] = [];
  const updateNewVersion: PathAndCacheKey[] = [];
  const updateOldVersion: PathAndCacheKey[] = [];
  const remove: PathAndCacheKey[] = [];

  for (let item of saved) {
    const { lastUpdated, ...pathAndCacheKey } = item;

    if (currentFiles[item.path] === undefined) {
      // Was indexed, but no longer exists. Remove
      remove.push(pathAndCacheKey);
    } else {
      // Exists in old and new, so determine whether it was updated
      if (lastUpdated < currentFiles[item.path]) {
        // Change was made after last update
        updateNewVersion.push({
          path: pathAndCacheKey.path,
          cacheKey: calculateHash(await readFile(pathAndCacheKey.path)),
        });
        updateOldVersion.push(pathAndCacheKey);
      } else {
        // Already updated, do nothing
      }

      // Remove so we can check leftovers afterward
      delete currentFiles[item.path];
    }
  }

  // Any leftover in current files need to be added
  add.push(
    ...(await Promise.all(
      Object.keys(currentFiles).map(async (path) => {
        const fileContents = await readFile(path);
        return { path, cacheKey: calculateHash(fileContents) };
      }),
    )),
  );

  // Create the markComplete callback function
  const db = await SqliteDb.get();
  const itemToAction: {
    [key: string]: [PathAndCacheKey, AddRemoveResultType];
  } = {};

  async function markComplete(items: PathAndCacheKey[], _: IndexResultType) {
    const actions = items.map((item) => itemToAction[JSON.stringify(item)]);
    for (const [{ path, cacheKey }, resultType] of actions) {
      switch (resultType) {
        case AddRemoveResultType.Add:
          await db.run(
            `INSERT INTO tag_catalog (path, cacheKey, lastUpdated, dir, branch, artifactId) VALUES (?, ?, ?, ?, ?, ?)`,
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

  for (let item of updateNewVersion) {
    itemToAction[JSON.stringify(item)] = [
      item,
      AddRemoveResultType.UpdateNewVersion,
    ];
  }
  for (let item of add) {
    itemToAction[JSON.stringify(item)] = [item, AddRemoveResultType.Add];
  }
  for (let item of updateOldVersion) {
    itemToAction[JSON.stringify(item)] = [
      item,
      AddRemoveResultType.UpdateOldVersion,
    ];
  }
  for (let item of remove) {
    itemToAction[JSON.stringify(item)] = [item, AddRemoveResultType.Remove];
  }

  return [
    [...add, ...updateNewVersion],
    [...remove, ...updateOldVersion],
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
    `SELECT dir, branch, artifactId FROM global_cache WHERE cacheKey = ? AND artifactId = ?`,
  );
  const rows = await stmt.all(cacheKey, artifactId);
  return rows;
}

function calculateHash(fileContents: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fileContents);
  return hash.digest("hex");
}

export async function getComputeDeleteAddRemove(
  tag: IndexTag,
  currentFiles: LastModifiedMap,
  readFile: (path: string) => Promise<string>,
): Promise<[RefreshIndexResults, MarkCompleteCallback]> {
  const [add, remove, markComplete] = await getAddRemoveForTag(
    tag,
    currentFiles,
    readFile,
  );

  const compute: PathAndCacheKey[] = [];
  const del: PathAndCacheKey[] = [];
  const addTag: PathAndCacheKey[] = [];
  const removeTag: PathAndCacheKey[] = [];

  for (let { path, cacheKey } of add) {
    const existingTags = await getTagsFromGlobalCache(cacheKey, tag.artifactId);
    if (existingTags.length > 0) {
      addTag.push({ path, cacheKey });
    } else {
      compute.push({ path, cacheKey });
    }
  }

  for (let { path, cacheKey } of remove) {
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
    async (items, resultType) => {
      // Update tag catalog
      markComplete(items, resultType);

      // Update the global cache
      let results: any = {
        compute: [],
        del: [],
        addTag: [],
        removeTag: [],
      };
      results[resultType] = items;
      for await (let _ of globalCacheIndex.update(tag, results, () => {})) {
      }
    },
  ];
}

export class GlobalCacheCodeBaseIndex implements CodebaseIndex {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }
  artifactId: string = "globalCache";

  static async create(): Promise<GlobalCacheCodeBaseIndex> {
    return new GlobalCacheCodeBaseIndex(await SqliteDb.get());
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    _: MarkCompleteCallback,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const add = [...results.compute, ...results.addTag];
    const remove = [...results.del, ...results.removeTag];
    await Promise.all([
      ...add.map(({ cacheKey }) => {
        return this.computeOrAddTag(cacheKey, tag);
      }),
      ...remove.map(({ cacheKey }) => {
        return this.deleteOrRemoveTag(cacheKey, tag);
      }),
    ]);
    yield { progress: 1, desc: "Done updating global cache" };
  }

  private async computeOrAddTag(
    cacheKey: string,
    tag: IndexTag,
  ): Promise<void> {
    await this.db.run(
      "INSERT INTO global_cache (cacheKey, dir, branch, artifactId) VALUES (?, ?, ?, ?)",
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
