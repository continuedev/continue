import { DatabaseConnection, SqliteDb } from "./refreshIndex.js";
import {
  IndexResultType,
  MarkCompleteCallback,
  RefreshIndexResults,
  type CodebaseIndex,
} from "./types.js";

import type { IndexTag, IndexingProgressUpdate } from "../index.js";

/**
 * This is a CodebaseIndex used for testing which files get indexed.
 * It maintains a SQLite database of all file/tag pairs
 */
export class TestCodebaseIndex implements CodebaseIndex {
  relativeExpectedTime: number = 0.1;
  artifactId = "__test__";

  private static async _createTables(db: DatabaseConnection) {
    db.exec(`CREATE TABLE IF NOT EXISTS test_index (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL,
        branch TEXT NOT NULL,
        directory TEXT NOT NULL
    )`);
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate, any, unknown> {
    const db = await SqliteDb.get();
    await TestCodebaseIndex._createTables(db);

    for (const item of [...results.compute, ...results.addTag]) {
      db.prepare(
        "INSERT INTO test_index (path, branch, directory) VALUES (?, ?, ?)",
      ).run(item.path, tag.branch, tag.directory);
    }

    for (const item of [...results.del, ...results.removeTag]) {
      db.prepare(
        "DELETE FROM test_index WHERE path = ? AND branch = ? AND directory = ?",
      ).run(item.path, tag.branch, tag.directory);
    }

    await markComplete(results.compute, IndexResultType.Compute);
    await markComplete(results.addTag, IndexResultType.AddTag);
    await markComplete(results.del, IndexResultType.Delete);
    await markComplete(results.removeTag, IndexResultType.RemoveTag);
  }

  async getIndexedFilesForTags(tags: IndexTag[]): Promise<string[]> {
    const db = await SqliteDb.get();
    await TestCodebaseIndex._createTables(db);

    const rows = db
      .prepare(
        `SELECT path FROM test_index WHERE (branch, directory) IN (VALUES ${tags
          .map(() => "(?, ?)")
          .join(", ")})`,
      )
      .all(...tags.flatMap((tag) => [tag.branch, tag.directory])) as any[];

    return rows.map((row: any) => row.path);
  }

  async clearDatabase(): Promise<void> {
    const db = await SqliteDb.get();
    await TestCodebaseIndex._createTables(db);
    db.prepare("DELETE FROM test_index").run();
  }
}
