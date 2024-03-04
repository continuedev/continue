import fs from "fs";
import path from "path";
import { ChunkWithoutID, IDE, IndexingProgressUpdate } from "..";
import {
  getLanguageForFile,
  getParserForFile,
  supportedLanguages,
} from "../util/treeSitter";
import { DatabaseConnection, SqliteDb } from "./refreshIndex";
import {
  CodebaseIndex,
  IndexResultType,
  IndexTag,
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
  }

  private getQuerySource(filepath: string) {
    const fullLangName = supportedLanguages[filepath.split(".").pop() ?? ""];
    const sourcePath = path.join(
      __dirname,
      "..",
      "tag-qry",
      `tree-sitter-${fullLangName}-tags.scm`,
    );
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

    for (let i = 0; i < results.compute.length; i++) {
      const compute = results.compute[i];
      const snippets = await this.getSnippetsInFile(
        compute.path,
        await this.ide.readFile(compute.path),
      );

      // Add snippets to sqlite
      for (const snippet of snippets) {
        await db.run(
          `INSERT INTO code_snippets (path, cacheKey, content, startLine, endLine) VALUES (?, ?, ?, ?, ?)`,
          [
            compute.path,
            compute.cacheKey,
            snippet.content,
            snippet.startLine,
            snippet.endLine,
          ],
        );
      }

      yield {
        desc: `Indexing ${compute.path}`,
        progress: i / results.compute.length,
      };
      markComplete([compute], IndexResultType.Compute);
    }
  }
}
