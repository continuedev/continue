import fs from "fs";

import { DatabaseConnection } from "../indexing/refreshIndex.js";

import { getDevDataSqlitePath } from "../util/paths.js";
import { openSqliteDatabase } from "../util/sqlite.js";

/* The Dev Data SQLITE table is only used for local tokens generated */
export class DevDataSqliteDb {
  static db: DatabaseConnection | null = null;
  private static warnedUnavailable = false;

  private static async createTables(db: DatabaseConnection) {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS tokens_generated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            tokens_generated INTEGER NOT NULL,
            tokens_prompt INTEGER NOT NULL DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    );

    // Add tokens_prompt column if it doesn't exist
    const columnCheckResult = await db.all(
      "PRAGMA table_info(tokens_generated);",
    );
    const columnExists = columnCheckResult.some(
      (col: any) => col.name === "tokens_prompt",
    );
    if (!columnExists) {
      await db.exec(
        "ALTER TABLE tokens_generated ADD COLUMN tokens_prompt INTEGER NOT NULL DEFAULT 0;",
      );
    }
  }

  public static async logTokensGenerated(
    model: string,
    provider: string,
    promptTokens: number,
    generatedTokens: number,
  ) {
    const db = await DevDataSqliteDb.get();
    await db?.run(
      "INSERT INTO tokens_generated (model, provider, tokens_prompt, tokens_generated) VALUES (?, ?, ?, ?)",
      [model, provider, promptTokens, generatedTokens],
    );
  }

  public static async getTokensPerDay() {
    const db = await DevDataSqliteDb.get();
    const result = await db?.all(
      // Return a sum of tokens_generated and tokens_prompt columns aggregated by day
      `SELECT date(timestamp) as day, sum(tokens_prompt) as promptTokens, sum(tokens_generated) as generatedTokens
        FROM tokens_generated
        GROUP BY date(timestamp)`,
    );
    return result ?? [];
  }

  public static async getTokensPerModel() {
    const db = await DevDataSqliteDb.get();
    const result = await db?.all(
      // Return a sum of tokens_generated and tokens_prompt columns aggregated by model
      `SELECT model, sum(tokens_prompt) as promptTokens, sum(tokens_generated) as generatedTokens
        FROM tokens_generated
        GROUP BY model`,
    );
    return result ?? [];
  }

  /** Returns null when SQLite is unavailable: token counts are best effort. */
  static async get(): Promise<DatabaseConnection | null> {
    const devDataSqlitePath = getDevDataSqlitePath();
    if (DevDataSqliteDb.db && fs.existsSync(devDataSqlitePath)) {
      return DevDataSqliteDb.db;
    }

    try {
      const db = await openSqliteDatabase(devDataSqlitePath);
      await db.exec("PRAGMA busy_timeout = 3000;");
      await DevDataSqliteDb.createTables(db);
      DevDataSqliteDb.db = db;
    } catch (error) {
      if (!DevDataSqliteDb.warnedUnavailable) {
        DevDataSqliteDb.warnedUnavailable = true;
        console.warn("Token usage is not recorded: SQLite unavailable", error);
      }
      DevDataSqliteDb.db = null;
    }

    return DevDataSqliteDb.db;
  }
}
