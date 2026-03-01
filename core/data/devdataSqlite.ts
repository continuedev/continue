import fs from "fs";

import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";

import { getDevDataSqlitePath } from "../util/paths.js";

/* The Dev Data SQLITE table is only used for local tokens generated */
export class DevDataSqliteDb {
  static db: BetterSqlite3.Database | null = null;

  private static createTables(db: BetterSqlite3.Database) {
    db.exec(
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
    const columnCheckResult = db
      .prepare("PRAGMA table_info(tokens_generated);")
      .all() as any[];
    const columnExists = columnCheckResult.some(
      (col: any) => col.name === "tokens_prompt",
    );
    if (!columnExists) {
      db.exec(
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
    db
      ?.prepare(
        "INSERT INTO tokens_generated (model, provider, tokens_prompt, tokens_generated) VALUES (?, ?, ?, ?)",
      )
      .run(model, provider, promptTokens, generatedTokens);
  }

  public static async getTokensPerDay() {
    const db = await DevDataSqliteDb.get();
    const result = db
      ?.prepare(
        `SELECT date(timestamp) as day, sum(tokens_prompt) as promptTokens, sum(tokens_generated) as generatedTokens
        FROM tokens_generated
        GROUP BY date(timestamp)`,
      )
      .all();
    return result ?? [];
  }

  public static async getTokensPerModel() {
    const db = await DevDataSqliteDb.get();
    const result = db
      ?.prepare(
        `SELECT model, sum(tokens_prompt) as promptTokens, sum(tokens_generated) as generatedTokens
        FROM tokens_generated
        GROUP BY model`,
      )
      .all();
    return result ?? [];
  }

  static async get() {
    const devDataSqlitePath = getDevDataSqlitePath();
    if (DevDataSqliteDb.db && fs.existsSync(devDataSqlitePath)) {
      return DevDataSqliteDb.db;
    }

    DevDataSqliteDb.db = new Database(devDataSqlitePath);

    DevDataSqliteDb.db.pragma("busy_timeout = 3000");

    DevDataSqliteDb.createTables(DevDataSqliteDb.db!);

    return DevDataSqliteDb.db;
  }
}
