import fs from "fs";
import path from "path";
import os from "os";

import { open } from "sqlite";
import sqlite3 from "sqlite3";

import { DatabaseConnection } from "../indexing/refreshIndex.js";
import { ChatMessage } from "../index.js";

function getShadowChatDbPath(): string {
  const devDataDir = path.join(os.homedir(), ".continue", "devdata");
  if (!fs.existsSync(devDataDir)) {
    fs.mkdirSync(devDataDir, { recursive: true });
  }
  return path.join(devDataDir, "shadow-chat.sqlite");
}

// FTS5's MATCH syntax treats punctuation (?, ", *, (, ), :, -, ...) as query
// operators, so a natural-language query like "did we talk about coding?"
// is a syntax error, not just a search with no results. Quoting it as a
// literal phrase sidesteps FTS5 query syntax entirely.
function toFtsQuery(query: string): string {
  return `"${query.replace(/"/g, '""')}"`;
}

export class ShadowChatDb {
  static db: DatabaseConnection | null = null;

  private static async createTables(db: DatabaseConnection): Promise<void> {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS shadow_sessions (
        session_id TEXT PRIMARY KEY,
        ultra_mode_enabled INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shadow_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shadow_turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_message TEXT NOT NULL,
        response TEXT NOT NULL DEFAULT '',
        actual_tokens_in INTEGER NOT NULL DEFAULT 0,
        actual_tokens_out INTEGER NOT NULL DEFAULT 0,
        estimated_baseline_tokens INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shadow_tool_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_call_id TEXT NOT NULL UNIQUE,
        input_args TEXT NOT NULL DEFAULT '',
        result TEXT NOT NULL,
        turn_index INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS shadow_messages_fts
        USING fts5(content, content='shadow_messages', content_rowid='id');

      CREATE TRIGGER IF NOT EXISTS shadow_messages_ai
        AFTER INSERT ON shadow_messages BEGIN
          INSERT INTO shadow_messages_fts(rowid, content) VALUES (new.id, new.content);
        END;
    `);

    // Migration for DBs created before input_args existed
    const columns = await db.all("PRAGMA table_info(shadow_tool_results)");
    if (!columns.some((c: any) => c.name === "input_args")) {
      await db.exec(
        "ALTER TABLE shadow_tool_results ADD COLUMN input_args TEXT NOT NULL DEFAULT ''",
      );
    }
  }

  static async get(): Promise<DatabaseConnection | null> {
    const dbPath = getShadowChatDbPath();
    if (ShadowChatDb.db && fs.existsSync(dbPath)) {
      return ShadowChatDb.db;
    }
    ShadowChatDb.db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    await ShadowChatDb.db.exec("PRAGMA busy_timeout = 3000;");
    await ShadowChatDb.createTables(ShadowChatDb.db);
    return ShadowChatDb.db;
  }

  static async createSession(
    sessionId: string,
    ultraModeEnabled: boolean,
  ): Promise<void> {
    const db = await ShadowChatDb.get();
    await db?.run(
      "INSERT OR IGNORE INTO shadow_sessions (session_id, ultra_mode_enabled) VALUES (?, ?)",
      [sessionId, ultraModeEnabled ? 1 : 0],
    );
  }

  static async getSession(
    sessionId: string,
  ): Promise<{ ultraModeEnabled: boolean } | undefined> {
    const db = await ShadowChatDb.get();
    const row = await db?.get(
      "SELECT ultra_mode_enabled FROM shadow_sessions WHERE session_id = ?",
      [sessionId],
    );
    if (!row) return undefined;
    return { ultraModeEnabled: row.ultra_mode_enabled === 1 };
  }

  static async saveMessages(
    sessionId: string,
    messages: ChatMessage[],
  ): Promise<void> {
    const db = await ShadowChatDb.get();
    if (!db) return;

    const existing = await db.get(
      "SELECT COUNT(*) as cnt FROM shadow_messages WHERE session_id = ?",
      [sessionId],
    );
    const toInsert = messages.slice(existing?.cnt ?? 0);
    if (toInsert.length === 0) return;

    for (const msg of toInsert) {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);

      await db.run(
        "INSERT INTO shadow_messages (session_id, role, content) VALUES (?, ?, ?)",
        [sessionId, msg.role, content],
      );
    }
  }

  // Current turn count for a session — used both for shadow_turns/tool-result
  // age tracking and as the turn index stamped on newly-saved tool calls.
  static async getCurrentTurnIndex(sessionId: string): Promise<number> {
    const db = await ShadowChatDb.get();
    const turnRow = await db?.get(
      "SELECT COUNT(*) as cnt FROM shadow_turns WHERE session_id = ?",
      [sessionId],
    );
    return turnRow?.cnt ?? 0;
  }

  // Records a tool call's input and output at the moment it executes, so
  // shadow_get_tool_result can serve it immediately (not one turn late).
  static async saveToolCall(
    sessionId: string,
    toolName: string,
    toolCallId: string,
    inputArgs: string,
    result: string,
    turnIndex: number,
  ): Promise<void> {
    const db = await ShadowChatDb.get();
    await db?.run(
      `INSERT INTO shadow_tool_results
         (session_id, tool_name, tool_call_id, input_args, result, turn_index)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tool_call_id) DO UPDATE SET
         input_args = excluded.input_args,
         result = excluded.result`,
      [sessionId, toolName, toolCallId, inputArgs, result, turnIndex],
    );
  }

  static async getHistory(
    sessionId: string,
    limit: number,
  ): Promise<ChatMessage[]> {
    const db = await ShadowChatDb.get();
    const rows = await db?.all(
      "SELECT role, content FROM shadow_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
      [sessionId, limit],
    );
    if (!rows) return [];
    return rows
      .reverse()
      .map((r: any) => ({ role: r.role, content: r.content }) as ChatMessage);
  }

  static async searchMessages(
    sessionId: string,
    query: string,
    limit: number,
  ): Promise<ChatMessage[]> {
    const db = await ShadowChatDb.get();
    const rows = await db?.all(
      `SELECT role, content FROM shadow_messages
       WHERE session_id = ? AND content LIKE ?
       ORDER BY id DESC LIMIT ?`,
      [sessionId, `%${query}%`, limit],
    );
    if (!rows) return [];
    return rows.map(
      (r: any) => ({ role: r.role, content: r.content }) as ChatMessage,
    );
  }

  // FTS5 ranked full-text search within a session (BM25 scoring)
  static async semanticSearch(
    sessionId: string,
    query: string,
    limit: number,
  ): Promise<ChatMessage[]> {
    const db = await ShadowChatDb.get();
    const rows = await db?.all(
      `SELECT m.role, m.content
       FROM shadow_messages_fts fts
       JOIN shadow_messages m ON m.id = fts.rowid
       WHERE fts.content MATCH ? AND m.session_id = ?
       ORDER BY rank
       LIMIT ?`,
      [toFtsQuery(query), sessionId, limit],
    );
    if (!rows) return [];
    return rows.map(
      (r: any) => ({ role: r.role, content: r.content }) as ChatMessage,
    );
  }

  // Keyword search across all sessions
  static async searchAllSessions(
    query: string,
    limit: number,
  ): Promise<Array<ChatMessage & { sessionId: string }>> {
    const db = await ShadowChatDb.get();
    const rows = await db?.all(
      `SELECT session_id, role, content FROM shadow_messages
       WHERE content LIKE ?
       ORDER BY id DESC LIMIT ?`,
      [`%${query}%`, limit],
    );
    if (!rows) return [];
    return rows.map((r: any) => ({
      role: r.role,
      content: r.content,
      sessionId: r.session_id,
    }));
  }

  // FTS5 ranked full-text search across all sessions
  static async semanticSearchAllSessions(
    query: string,
    limit: number,
  ): Promise<Array<ChatMessage & { sessionId: string }>> {
    const db = await ShadowChatDb.get();
    const rows = await db?.all(
      `SELECT m.session_id, m.role, m.content
       FROM shadow_messages_fts fts
       JOIN shadow_messages m ON m.id = fts.rowid
       WHERE fts.content MATCH ?
       ORDER BY rank
       LIMIT ?`,
      [toFtsQuery(query), limit],
    );
    if (!rows) return [];
    return rows.map((r: any) => ({
      role: r.role,
      content: r.content,
      sessionId: r.session_id,
    }));
  }

  static async getConversationStats(sessionId: string): Promise<{
    messageCount: number;
    turnCount: number;
    totalTokensSaved: number;
    totalActualTokensIn: number;
    totalEstimatedBaselineTokens: number;
  }> {
    const db = await ShadowChatDb.get();
    const msgRow = await db?.get(
      "SELECT COUNT(*) as cnt FROM shadow_messages WHERE session_id = ?",
      [sessionId],
    );
    const turnRow = await db?.get(
      `SELECT
         COUNT(*) as turn_count,
         COALESCE(SUM(estimated_baseline_tokens - actual_tokens_in), 0) as tokens_saved,
         COALESCE(SUM(actual_tokens_in), 0) as tokens_in,
         COALESCE(SUM(estimated_baseline_tokens), 0) as baseline
       FROM shadow_turns WHERE session_id = ?`,
      [sessionId],
    );
    return {
      messageCount: msgRow?.cnt ?? 0,
      turnCount: turnRow?.turn_count ?? 0,
      totalTokensSaved: turnRow?.tokens_saved ?? 0,
      totalActualTokensIn: turnRow?.tokens_in ?? 0,
      totalEstimatedBaselineTokens: turnRow?.baseline ?? 0,
    };
  }

  static async getToolResult(
    sessionId: string,
    toolName: string,
    maxAgeTurns: number,
  ): Promise<{ inputArgs: string; result: string } | undefined> {
    const db = await ShadowChatDb.get();
    const currentTurnIndex = await ShadowChatDb.getCurrentTurnIndex(sessionId);
    const minTurnIndex = Math.max(0, currentTurnIndex - maxAgeTurns);

    const row = await db?.get(
      `SELECT input_args, result FROM shadow_tool_results
       WHERE session_id = ? AND tool_name = ? AND turn_index >= ?
       ORDER BY id DESC LIMIT 1`,
      [sessionId, toolName, minTurnIndex],
    );
    if (!row) return undefined;
    return { inputArgs: row.input_args, result: row.result };
  }

  static async saveTurn(
    sessionId: string,
    userMessage: string,
    response: string,
    actualTokensIn: number,
    actualTokensOut: number,
    estimatedBaselineTokens: number,
  ): Promise<void> {
    const db = await ShadowChatDb.get();
    await db?.run(
      `INSERT INTO shadow_turns
        (session_id, user_message, response, actual_tokens_in, actual_tokens_out, estimated_baseline_tokens)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        userMessage,
        response,
        actualTokensIn,
        actualTokensOut,
        estimatedBaselineTokens,
      ],
    );
  }
}
