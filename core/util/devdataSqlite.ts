import fs from "fs";
import { DatabaseConnection } from "../indexing/refreshIndex.js";
import { getDevDataSqlitePath } from "./paths.js";

export class DevDataSqliteDb {
  static db: DatabaseConnection | null = null;

  private static async createTables(db: DatabaseConnection) {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS tokens_generated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            tokens_generated INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    );
  }

  public static async logTokensGenerated(
    model: string,
    provider: string,
    tokens: number,
  ) {
    const db = await DevDataSqliteDb.get();
    await db?.run(
      "INSERT INTO tokens_generated (model, provider, tokens_generated) VALUES (?, ?, ?)",
      [model, provider, tokens],
    );
  }

  public static async getTokensPerDay() {
    const db = await DevDataSqliteDb.get();
    // Return a sum of tokens_generated column aggregated by day
    const result = await db?.all(
      `SELECT date(timestamp) as day, sum(tokens_generated) as tokens
        FROM tokens_generated
        GROUP BY date(timestamp)`,
      // WHERE model = ? AND provider = ?
      // [model, provider],
    );
    return result ?? [];
  }

  public static async getTokensPerModel() {
    const db = await DevDataSqliteDb.get();
    // Return a sum of tokens_generated column aggregated by model
    const result = await db?.all(
      `SELECT model, sum(tokens_generated) as tokens
        FROM tokens_generated
        GROUP BY model`,
    );
    return result ?? [];
  }

  static async get() {
    const devDataSqlitePath = getDevDataSqlitePath();
    if (DevDataSqliteDb.db && fs.existsSync(devDataSqlitePath)) {
      return DevDataSqliteDb.db;
    }

    const { open } = require("sqlite");
    const sqlite3 = require("sqlite3");
    DevDataSqliteDb.db = await open({
      filename: devDataSqlitePath,
      driver: sqlite3.Database,
    });

    await DevDataSqliteDb.createTables(DevDataSqliteDb.db!);

    return DevDataSqliteDb.db;
  }
}
