import type {
  ChunkWithoutID,
  ContextItem,
  ContextSubmenuItem,
  IDE,
  IndexTag,
  IndexingProgressUpdate,
} from "../index.js";
import { getBasename, getLastNPathParts } from "../util/index.js";
import { migrate } from "../util/paths.js";
import {
  TSQueryType,
  getParserForFile,
  getQueryForFile,
} from "../util/treeSitter.js";
import { DatabaseConnection, SqliteDb, tagToString } from "./refreshIndex.js";
import {
  IndexResultType,
  MarkCompleteCallback,
  RefreshIndexResults,
  type CodebaseIndex,
} from "./types.js";

export class CodeSnippetsCodebaseIndex implements CodebaseIndex {
  relativeExpectedTime: number = 1;
  artifactId = "codeSnippets";

  constructor(private readonly ide: IDE) {}

  private static async _createTables(db: DatabaseConnection) {
    await db.exec("PRAGMA journal_mode=WAL;");

    await db.exec(`CREATE TABLE IF NOT EXISTS code_snippets (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL,
        cacheKey TEXT NOT NULL,
        content TEXT NOT NULL,
        title TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS code_snippets_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      snippetId INTEGER NOT NULL,
      FOREIGN KEY (snippetId) REFERENCES code_snippets (id)
    )`);

    migrate("delete_duplicate_code_snippets", async () => {
      // Delete duplicate entries in code_snippets
      await db.exec(`
        DELETE FROM code_snippets
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM code_snippets
          GROUP BY path, cacheKey, content, title, startLine, endLine
        )
      `);

      // Add unique constraint if it doesn't exist
      await db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_code_snippets_unique
        ON code_snippets (path, cacheKey, content, title, startLine, endLine)
      `);

      // Delete code_snippets associated with duplicate code_snippets_tags entries
      await db.exec(`
        DELETE FROM code_snippets
        WHERE id IN (
          SELECT snippetId
          FROM code_snippets_tags
          WHERE (snippetId, tag) IN (
            SELECT snippetId, tag
            FROM code_snippets_tags
            GROUP BY snippetId, tag
            HAVING COUNT(*) > 1
          )
        )
      `);

      // Delete duplicate entries
      await db.exec(`
        DELETE FROM code_snippets_tags
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM code_snippets_tags
          GROUP BY snippetId, tag
        )
      `);

      // Add unique constraint if it doesn't exist
      await db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_snippetId_tag
        ON code_snippets_tags (snippetId, tag)
      `);
    });
  }

  async getSnippetsInFile(
    filepath: string,
    contents: string,
  ): Promise<(ChunkWithoutID & { title: string })[]> {
    const parser = await getParserForFile(filepath);
    if (!parser) {
      return [];
    }
    const ast = parser.parse(contents);
    const query = await getQueryForFile(filepath, TSQueryType.CodeSnippets);
    const matches = query?.matches(ast.rootNode);

    return (
      matches?.flatMap((match) => {
        const node = match.captures[0].node;
        const title = match.captures[1].node.text;
        const results = {
          title,
          content: node.text,
          startLine: node.startPosition.row,
          endLine: node.endPosition.row,
        };
        return results;
      }) ?? []
    );
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate, any, unknown> {
    const db = await SqliteDb.get();
    await CodeSnippetsCodebaseIndex._createTables(db);
    const tagString = tagToString(tag);

    for (let i = 0; i < results.compute.length; i++) {
      const compute = results.compute[i];

      let snippets: (ChunkWithoutID & { title: string })[] = [];
      try {
        snippets = await this.getSnippetsInFile(
          compute.path,
          await this.ide.readFile(compute.path),
        );
      } catch (e) {
        // If can't parse, assume malformatted code
        console.error(`Error parsing ${compute.path}:`, e);
      }

      // Add snippets to sqlite
      for (const snippet of snippets) {
        const { lastID } = await db.run(
          "REPLACE INTO code_snippets (path, cacheKey, content, title, startLine, endLine) VALUES (?, ?, ?, ?, ?, ?)",
          [
            compute.path,
            compute.cacheKey,
            snippet.content,
            snippet.title,
            snippet.startLine,
            snippet.endLine,
          ],
        );

        await db.run(
          "REPLACE INTO code_snippets_tags (snippetId, tag) VALUES (?, ?)",
          [lastID, tagString],
        );
      }

      yield {
        desc: `Indexing ${getBasename(compute.path)}`,
        progress: i / results.compute.length,
        status: "indexing",
      };
      markComplete([compute], IndexResultType.Compute);
    }

    for (let i = 0; i < results.del.length; i++) {
      const del = results.del[i];
      const deleted = await db.run(
        "DELETE FROM code_snippets WHERE path = ? AND cacheKey = ?",
        [del.path, del.cacheKey],
      );
      await db.run("DELETE FROM code_snippets_tags WHERE snippetId = ?", [
        deleted.lastID,
      ]);
      markComplete([del], IndexResultType.Delete);
    }

    for (let i = 0; i < results.addTag.length; i++) {
      const addTag = results.addTag[i];
      let snippets: (ChunkWithoutID & { title: string })[] = [];
      try {
        snippets = await this.getSnippetsInFile(
          addTag.path,
          await this.ide.readFile(addTag.path),
        );
      } catch (e) {
        // If can't parse, assume malformatted code
        console.error(`Error parsing ${addTag.path}:`, e);
      }

      for (const snippet of snippets) {
        const { lastID } = await db.run(
          "INSERT INTO code_snippets (path, cacheKey, content, title, startLine, endLine) VALUES (?, ?, ?, ?, ?, ?)",
          [
            addTag.path,
            addTag.cacheKey,
            snippet.content,
            snippet.title,
            snippet.startLine,
            snippet.endLine,
          ],
        );
        await db.run(
          "INSERT INTO code_snippets_tags (snippetId, tag) VALUES (?, ?)",
          [lastID, tagString],
        );
      }

      markComplete([results.addTag[i]], IndexResultType.AddTag);
    }

    for (let i = 0; i < results.removeTag.length; i++) {
      const item = results.removeTag[i];
      await db.run(
        `
        DELETE FROM code_snippets_tags
        WHERE tag = ?
          AND snippetId IN (
            SELECT id FROM code_snippets
            WHERE cacheKey = ? AND path = ?
          )
      `,
        [tagString, item.cacheKey, item.path],
      );
      markComplete([results.removeTag[i]], IndexResultType.RemoveTag);
    }
  }

  static async getForId(id: number): Promise<ContextItem> {
    const db = await SqliteDb.get();
    const row = await db.get("SELECT * FROM code_snippets WHERE id = ?", [id]);

    return {
      name: row.title,
      description: getLastNPathParts(row.path, 2),
      content: `\`\`\`${getBasename(row.path)}\n${row.content}\n\`\`\``,
    };
  }

  static async getAll(tag: IndexTag): Promise<ContextSubmenuItem[]> {
    const db = await SqliteDb.get();
    await CodeSnippetsCodebaseIndex._createTables(db);
    try {
      const rows = await db.all(
        `SELECT cs.id, cs.path, cs.title
        FROM code_snippets cs
        JOIN code_snippets_tags cst ON cs.id = cst.snippetId
        WHERE cst.tag = ?;
        `,
        [tagToString(tag)],
      );

      return rows.map((row) => ({
        title: row.title,
        description: getLastNPathParts(row.path, 2),
        id: row.id.toString(),
      }));
    } catch (e) {
      console.warn("Error getting all code snippets: ", e);
      return [];
    }
  }
}
