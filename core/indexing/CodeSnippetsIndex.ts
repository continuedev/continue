import Parser from "web-tree-sitter";

import { migrate } from "../util/paths";
import {
  getFullLanguageName,
  getParserForFile,
  getQueryForFile,
} from "../util/treeSitter";

import { DatabaseConnection, SqliteDb, tagToString } from "./refreshIndex";
import {
  IndexResultType,
  MarkCompleteCallback,
  RefreshIndexResults,
  type CodebaseIndex,
} from "./types";

import type {
  ChunkWithoutID,
  ContextItem,
  ContextSubmenuItem,
  IDE,
  IndexTag,
  IndexingProgressUpdate,
} from "../";
import {
  findUriInDirs,
  getLastNPathParts,
  getLastNUriRelativePathParts,
  getUriPathBasename,
} from "../util/uri";

type SnippetChunk = ChunkWithoutID & { title: string; signature: string };

export class CodeSnippetsCodebaseIndex implements CodebaseIndex {
  relativeExpectedTime: number = 1;
  artifactId = "codeSnippets";

  constructor(private readonly ide: IDE) {}

  private static async _createTables(db: DatabaseConnection) {
    await db.exec(`CREATE TABLE IF NOT EXISTS code_snippets (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL,
        cacheKey TEXT NOT NULL,
        content TEXT NOT NULL,
        title TEXT NOT NULL,
        signature TEXT,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS code_snippets_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      snippetId INTEGER NOT NULL,
      FOREIGN KEY (snippetId) REFERENCES code_snippets (id)
    )`);

    await migrate("add_signature_column", async () => {
      const tableInfo = await db.all("PRAGMA table_info(code_snippets)");
      const signatureColumnExists = tableInfo.some(
        (column) => column.name === "signature",
      );

      if (!signatureColumnExists) {
        await db.exec(`
        ALTER TABLE code_snippets
        ADD COLUMN signature TEXT;
      `);
      }
    });

    await migrate("delete_duplicate_code_snippets", async () => {
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

  private getSnippetsFromMatch(match: Parser.QueryMatch): SnippetChunk {
    const bodyTypesToTreatAsSignatures = [
      "interface_declaration", // TypeScript, Java
      "struct_item", // Rust
      "type_spec", // Go
    ];

    const bodyCaptureGroupPrefixes = ["definition", "reference"];

    let title = "",
      content = "",
      signature = "",
      startLine = 0,
      endLine = 0,
      hasSeenBody = false;

    // This loop assumes that the ordering of the capture groups is represenatative
    // of the structure of the language, e.g. for a TypeScript match on a function,
    // `function myFunc(param: string): string`, the first capture would be the `myFunc`
    // the second capture would be the `(param: string)`, etc
    for (const { name, node } of match.captures) {
      // Assume we are capturing groups using a dot syntax for more precise groupings
      // However, for this case, we only care about the first substring
      const trimmedCaptureName = name.split(".")[0];

      const nodeText = node.text;
      const nodeType = node.type;

      if (bodyCaptureGroupPrefixes.includes(trimmedCaptureName)) {
        if (bodyTypesToTreatAsSignatures.includes(nodeType)) {
          // Note we override whatever existing value there is here
          signature = nodeText;
          hasSeenBody = true;
        }

        content = nodeText;
        startLine = node.startPosition.row;
        endLine = node.endPosition.row;
      } else {
        if (trimmedCaptureName === "name") {
          title = nodeText;
        }

        if (!hasSeenBody) {
          signature += nodeText + " ";

          if (trimmedCaptureName === "comment") {
            signature += "\n";
          }
        }
      }
    }

    return { title, content, signature, startLine, endLine };
  }

  async getSnippetsInFile(
    filepath: string,
    contents: string,
  ): Promise<SnippetChunk[]> {
    const parser = await getParserForFile(filepath);

    if (!parser) {
      return [];
    }

    const ast = parser.parse(contents);

    const language = getFullLanguageName(filepath);
    if (!language) {
      return [];
    }
    const query = await getQueryForFile(
      filepath,
      `code-snippet-queries/${language}.scm`,
    );
    const matches = query?.matches(ast.rootNode);

    if (!matches) {
      return [];
    }

    return matches.map(this.getSnippetsFromMatch);
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

    // Compute
    for (let i = 0; i < results.compute.length; i++) {
      const compute = results.compute[i];

      let snippets: SnippetChunk[] = [];
      try {
        snippets = await this.getSnippetsInFile(
          compute.path,
          await this.ide.readFile(compute.path),
        );
      } catch (e) {
        // If can't parse, assume malformatted code
      }

      // Add snippets to sqlite
      for (const snippet of snippets) {
        const { lastID } = await db.run(
          "REPLACE INTO code_snippets (path, cacheKey, content, title, signature, startLine, endLine) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            compute.path,
            compute.cacheKey,
            snippet.content,
            snippet.title,
            snippet.signature,
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
        desc: `Indexing ${getUriPathBasename(compute.path)}`,
        progress: i / results.compute.length,
        status: "indexing",
      };
      await markComplete([compute], IndexResultType.Compute);
    }

    // Delete
    for (let i = 0; i < results.del.length; i++) {
      const del = results.del[i];

      const snippets = await db.all(
        "SELECT id FROM code_snippets WHERE path = ? AND cacheKey = ?",
        [del.path, del.cacheKey],
      );

      if (snippets) {
        const snippetIds = snippets.map((row) => row.id).join(",");

        await db.run(`DELETE FROM code_snippets WHERE id IN (${snippetIds})`);

        await db.run(
          `DELETE FROM code_snippets_tags WHERE snippetId IN (${snippetIds})`,
        );
      }

      await markComplete([del], IndexResultType.Delete);
    }

    // Add tag
    for (let i = 0; i < results.addTag.length; i++) {
      const addTag = results.addTag[i];
      let snippets: SnippetChunk[] = [];
      try {
        snippets = await this.getSnippetsInFile(
          addTag.path,
          await this.ide.readFile(addTag.path),
        );
      } catch (e) {
        // If can't parse, assume malformatted code
      }

      for (const snippet of snippets) {
        const { lastID } = await db.run(
          "REPLACE INTO code_snippets (path, cacheKey, content, title, signature, startLine, endLine) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            addTag.path,
            addTag.cacheKey,
            snippet.content,
            snippet.title,
            snippet.signature,
            snippet.startLine,
            snippet.endLine,
          ],
        );
        await db.run(
          "REPLACE INTO code_snippets_tags (snippetId, tag) VALUES (?, ?)",
          [lastID, tagString],
        );
      }

      await markComplete([results.addTag[i]], IndexResultType.AddTag);
    }

    // Remove tag
    for (let i = 0; i < results.removeTag.length; i++) {
      const removeTag = results.removeTag[i];

      let snippets = await db.get(
        `SELECT id FROM code_snippets
            WHERE cacheKey = ? AND path = ?`,
        [removeTag.cacheKey, removeTag.path],
      );

      if (snippets) {
        if (!Array.isArray(snippets)) {
          snippets = [snippets];
        }

        const snippetIds = snippets.map((row: any) => row.id).join(",");

        await db.run(
          `
          DELETE FROM code_snippets_tags
          WHERE tag = ?
            AND snippetId IN (${snippetIds})
        `,
          [tagString],
        );
      }

      await markComplete([results.removeTag[i]], IndexResultType.RemoveTag);
    }
  }

  static async getForId(
    id: number,
    workspaceDirs: string[],
  ): Promise<ContextItem> {
    const db = await SqliteDb.get();
    const row = await db.get("SELECT * FROM code_snippets WHERE id = ?", [id]);

    const last2Parts = getLastNUriRelativePathParts(workspaceDirs, row.path, 2);
    const { relativePathOrBasename } = findUriInDirs(row.path, workspaceDirs);
    return {
      name: row.title,
      description: last2Parts,
      content: `\`\`\`${relativePathOrBasename}\n${row.content}\n\`\`\``,
      uri: {
        type: "file",
        value: row.path,
      },
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

  static async getPathsAndSignatures(
    workspaceDirs: string[],
    uriOffset: number = 0,
    uriBatchSize: number = 100,
    snippetOffset: number = 0,
    snippetBatchSize: number = 100,
  ): Promise<{
    groupedByUri: { [path: string]: string[] };
    hasMoreSnippets: boolean;
    hasMoreUris: boolean;
  }> {
    const db = await SqliteDb.get();
    await CodeSnippetsCodebaseIndex._createTables(db);

    const endIndex = uriOffset + uriBatchSize;
    const uriBatch = workspaceDirs.slice(uriOffset, endIndex);

    const likePatterns = uriBatch.map((dir) => `${dir}%`);

    const placeholders = likePatterns.map(() => "?").join(" OR path LIKE ");

    const query = `
    SELECT DISTINCT path, signature
    FROM code_snippets
    WHERE path LIKE ${placeholders}
    ORDER BY path, signature
    LIMIT ? OFFSET ?
  `;

    const rows = await db.all(query, [
      ...likePatterns,
      snippetBatchSize,
      snippetOffset,
    ]);

    const groupedByUri: { [path: string]: string[] } = {};

    for (const { path, signature } of rows) {
      if (!groupedByUri[path]) {
        groupedByUri[path] = [];
      }
      groupedByUri[path].push(signature);
    }

    const hasMoreUris = endIndex < workspaceDirs.length;
    const hasMoreSnippets = rows.length === snippetBatchSize;

    return { groupedByUri, hasMoreUris, hasMoreSnippets };
  }
}
