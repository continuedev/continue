import fs from "fs";
import path from "path";
import {
  ChunkWithoutID,
  ContextItem,
  ContextSubmenuItem,
  IDE,
  IndexTag,
  IndexingProgressUpdate,
} from "..";
import { getBasename } from "../util";
import {
  getLanguageForFile,
  getParserForFile,
  supportedLanguages,
} from "../util/treeSitter";
import { DatabaseConnection, SqliteDb, tagToString } from "./refreshIndex";
import {
  CodebaseIndex,
  IndexResultType,
  MarkCompleteCallback,
  RefreshIndexResults,
} from "./types";

export class CodeSnippetsCodebaseIndex implements CodebaseIndex {
  artifactId = "codeSnippets";

  constructor(private readonly ide: IDE) {}

  private async _createTables(db: DatabaseConnection) {
    await db.exec(`CREATE TABLE IF NOT EXISTS code_snippets (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL,
        cacheKey TEXT NOT NULL,
        content TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS code_snippets_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      snippetId INTEGER NOT NULL,
      FOREIGN KEY (snippetId) REFERENCES code_snippets (id)
  )`);
  }

  private getQuerySource(filepath: string) {
    const fullLangName = supportedLanguages[filepath.split(".").pop() ?? ""];
    const sourcePath = path.join(
      __dirname,
      "..",
      "tag-qry",
      `tree-sitter-${fullLangName}-tags.scm`,
    );
    if (!fs.existsSync(sourcePath)) {
      return "";
    }
    return fs.readFileSync(sourcePath).toString();
  }

  async getSnippetsInFile(
    filepath: string,
    contents: string,
  ): Promise<ChunkWithoutID[]> {
    const lang = await getLanguageForFile(filepath);
    const parser = await getParserForFile(filepath);
    const ast = parser.parse(contents);
    const query = lang?.query(this.getQuerySource(filepath));
    const matches = query?.matches(ast.rootNode);

    return (
      matches?.flatMap((match) => {
        const nodes = match.captures.map((capture) => capture.node);
        const results = nodes.map((node) => ({
          content: node.text,
          startLine: node.startPosition.row,
          endLine: node.endPosition.row,
        }));
        return results;
      }) ?? []
    );
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
  ): AsyncGenerator<IndexingProgressUpdate, any, unknown> {
    const db = await SqliteDb.get();
    await this._createTables(db);
    const tagString = tagToString(tag);

    for (let i = 0; i < results.compute.length; i++) {
      const compute = results.compute[i];
      const snippets = await this.getSnippetsInFile(
        compute.path,
        await this.ide.readFile(compute.path),
      );

      // Add snippets to sqlite
      for (const snippet of snippets) {
        const { lastID } = await db.run(
          `INSERT INTO code_snippets (path, cacheKey, content, startLine, endLine) VALUES (?, ?, ?, ?, ?)`,
          [
            compute.path,
            compute.cacheKey,
            snippet.content,
            snippet.startLine,
            snippet.endLine,
          ],
        );

        await db.run(
          `INSERT INTO code_snippets_tags (snippetId, tag) VALUES (?, ?)`,
          [lastID, tagString],
        );
      }

      yield {
        desc: `Indexing ${compute.path}`,
        progress: i / results.compute.length,
      };
      markComplete([compute], IndexResultType.Compute);
    }

    for (let i = 0; i < results.del.length; i++) {
      const del = results.del[i];
      const deleted = await db.run(
        `DELETE FROM code_snippets WHERE path = ? AND cacheKey = ?`,
        [del.path, del.cacheKey],
      );
      await db.run(`DELETE FROM code_snippets_tags WHERE snippetId = ?`, [
        deleted.lastID,
      ]);
      markComplete([del], IndexResultType.Delete);
    }

    for (let i = 0; i < results.addTag.length; i++) {
      const snippetsWithPath = await db.all(
        `SELECT * FROM code_snippets WHERE cacheKey = ?`,
        [results.addTag[i].cacheKey],
      );

      for (const snippet of snippetsWithPath) {
        await db.run(
          `INSERT INTO code_snippet_tags (snippetId, tag) VALUES (?, ?)`,
          [snippet.id, tagString],
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
    const row = await db.get(`SELECT * FROM code_snippets WHERE id = ?`, [id]);

    return {
      name: getBasename(row.path),
      description: getBasename(row.path, 2),
      content: `\`\`\`${getBasename(row.path)}\n${row.content}\n\`\`\``,
    };
  }

  static async getAll(tag: IndexTag): Promise<ContextSubmenuItem[]> {
    const db = await SqliteDb.get();
    const rows = await db.all(
      `SELECT *
      FROM code_snippets cs
      JOIN code_snippets_tags cst ON cs.id = cst.snippetId
      WHERE cst.tag = ?;
      `,
      [tagToString(tag)],
    );

    return rows.map((row) => ({
      title: getBasename(row.path),
      description: getBasename(row.path, 2),
      id: row.id.toString(),
    }));
  }
}
