import { Mutex } from "async-mutex";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

import {
  DatabaseConnection,
  truncateSqliteLikePattern,
} from "../../indexing/refreshIndex.js";
import { getTabAutocompleteCacheSqlitePath } from "../../util/paths.js";

export class AutocompleteLruCache {
  private static capacity = 1000;
  private mutex = new Mutex();

  constructor(private db: DatabaseConnection) {}

  static async get(): Promise<AutocompleteLruCache> {
    const db = await open({
      filename: getTabAutocompleteCacheSqlitePath(),
      driver: sqlite3.Database,
    });

    await db.exec("PRAGMA busy_timeout = 3000;");

    await db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    return new AutocompleteLruCache(db);
  }

  async get(prefix: string): Promise<string | undefined> {
    // NOTE: Right now prompts with different suffixes will be considered the same

    // If the query is "co" and we have "c" -> "ontinue" in the cache,
    // we should return "ntinue" as the completion.
    // Have to make sure we take the key with shortest length
    const truncatedPrefix = truncateSqliteLikePattern(prefix);
    try {
      const result = await this.db.get(
        "SELECT key, value FROM cache WHERE ? LIKE key || '%' ORDER BY LENGTH(key) DESC LIMIT 1",
        truncatedPrefix,
      );
      // Validate that the cached completion is a valid completion for the prefix
      if (
        result &&
        result.value.startsWith(truncatedPrefix.slice(result.key.length))
      ) {
        await this.db.run(
          "UPDATE cache SET timestamp = ? WHERE key = ?",
          Date.now(),
          truncatedPrefix,
        );
        // And then truncate so we aren't writing something that's already there
        return result.value.slice(truncatedPrefix.length - result.key.length);
      }
    } catch (e) {
      // catches e.g. old SQLITE LIKE OR GLOB PATTERN TOO COMPLEX
      console.error(e);
    }

    return undefined;
  }

  async put(prefix: string, completion: string) {
    const release = await this.mutex.acquire();

    const truncatedPrefix = truncateSqliteLikePattern(prefix);
    try {
      await this.db.run("BEGIN TRANSACTION");

      try {
        const result = await this.db.get(
          "SELECT key FROM cache WHERE key = ?",
          truncatedPrefix,
        );

        if (result) {
          await this.db.run(
            "UPDATE cache SET value = ?, timestamp = ? WHERE key = ?",
            completion,
            Date.now(),
            truncatedPrefix,
          );
        } else {
          const count = await this.db.get(
            "SELECT COUNT(*) as count FROM cache",
          );

          if (count.count >= AutocompleteLruCache.capacity) {
            await this.db.run(
              "DELETE FROM cache WHERE key = (SELECT key FROM cache ORDER BY timestamp ASC LIMIT 1)",
            );
          }

          await this.db.run(
            "INSERT INTO cache (key, value, timestamp) VALUES (?, ?, ?)",
            truncatedPrefix,
            completion,
            Date.now(),
          );
        }

        await this.db.run("COMMIT");
      } catch (error) {
        await this.db.run("ROLLBACK");
        throw error;
      }
    } catch (e) {
      console.error("Error creating transaction: ", e);
    } finally {
      release();
    }
  }
}

export default AutocompleteLruCache;
