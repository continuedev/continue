import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { DatabaseConnection } from "../indexing/refreshIndex";
import { getTabAutocompleteCacheSqlitePath } from "../util/paths";

export class AutocompleteLruCache {
  private static capacity: number = 1000;

  db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  static async get(): Promise<AutocompleteLruCache> {
    const db = await open({
      filename: getTabAutocompleteCacheSqlitePath(),
      driver: sqlite3.Database,
    });

    await db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    return new AutocompleteLruCache(db);
  }

  async get(key: string): Promise<string | undefined> {
    const result = await this.db.get(
      "SELECT value FROM cache WHERE key = ?",
      key,
    );

    if (result) {
      await this.db.run(
        "UPDATE cache SET timestamp = ? WHERE key = ?",
        Date.now(),
        key,
      );
      return result.value;
    }

    return undefined;
  }

  async put(key: string, value: string) {
    const result = await this.db.get(
      "SELECT key FROM cache WHERE key = ?",
      key,
    );

    if (result) {
      await this.db.run(
        "UPDATE cache SET value = ?, timestamp = ? WHERE key = ?",
        value,
        Date.now(),
        key,
      );
    } else {
      const count = await this.db.get("SELECT COUNT(*) as count FROM cache");

      if (count.count >= AutocompleteLruCache.capacity) {
        await this.db.run(
          "DELETE FROM cache WHERE key = (SELECT key FROM cache ORDER BY timestamp ASC LIMIT 1)",
        );
      }

      await this.db.run(
        "INSERT INTO cache (key, value, timestamp) VALUES (?, ?, ?)",
        key,
        value,
        Date.now(),
      );
    }
  }
}

export default AutocompleteLruCache;
