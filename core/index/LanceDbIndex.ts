import * as lancedb from "vectordb";
import {
  CodebaseIndex,
  IndexTag,
  PathAndCacheKey,
  RefreshIndexResults,
  tagToString,
} from ".";
import { EmbeddingsProvider } from "..";
import { getLanceDbPathForProviderId } from "../util/paths";

interface LanceDbRow {
  vector: number[];
  contents: string;
  path: string;
  cacheKey: string;
  tags: string;
  startLine: number;
  endLine: number;
  [key: string]: any;
}

export class LanceDbIndex implements CodebaseIndex {
  static tableName: string = "main";

  get artifactId(): string {
    return "vectordb::" + this.embeddingsProvider.id;
  }

  embeddingsProvider: EmbeddingsProvider;
  readFile: (filepath: string) => Promise<string>;

  constructor(
    embeddingsProvider: EmbeddingsProvider,
    readFile: (filepath: string) => Promise<string>
  ) {
    this.embeddingsProvider = embeddingsProvider;
    this.readFile = readFile;
  }

  private tagToString(tag: IndexTag): string {
    return tagToString(tag);
  }

  private async computeChunks(
    items: PathAndCacheKey[],
    tagString: string
  ): Promise<LanceDbRow[]> {
    const contents = await Promise.all(
      items.map(({ path }) => this.readFile(path))
    );
    const partialRows: LanceDbRow[] = [];

    for (let i = 0; i < items.length; i++) {
      const chunks: string[] = []; // TODO;
      const embeddings = await this.embeddingsProvider.embed(chunks);
      partialRows.push(
        ...chunks.map((chunk, j) => {
          return {
            vector: embeddings[j],
            contents: chunk,
            path: items[i].path,
            cacheKey: items[i].cacheKey,
            tags: `,${tagString},`,
            startLine: 0,
            endLine: 0, // TODO
          };
        })
      );
    }

    return partialRows;
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults
  ): AsyncGenerator<number> {
    const tagString = tagToString(tag);
    const db = await lancedb.connect(
      getLanceDbPathForProviderId(this.embeddingsProvider.id)
    );
    const existingTables = await db.tableNames();
    if (existingTables.includes(LanceDbIndex.tableName)) {
      const table = await db.openTable(LanceDbIndex.tableName);

      // Compute
      const computedRows = await this.computeChunks(results.compute, tagString);
      await table.add(computedRows);

      // Delete
      await table.delete(
        `cacheKey IN (${results.del.map((r) => r.cacheKey).join(", ")})`
      ); // TODO: Is this the new or the old cacheKey though? I think that you are mixing : (

      // Add tag
      await table.update({
        where: results.addTag
          .map((r) => `(cacheKey = '${r.cacheKey}' AND path = '${r.path}')`)
          .join(" OR "),
        valuesSql: {
          tags: `tags || '${tagString},'`,
        },
      });

      // Remove tag
      for (let { path, cacheKey } of results.removeTag) {
        // They should all have the same tags column
        const rows = await table.where(
          `path = '${path}' AND cacheKey = '${cacheKey}'`
        );
      }
    } else {
      // If the table hasn't been created yet, then only the compute array should have elements
      const computedRows = await this.computeChunks(results.compute, tagString);
      await db.createTable(LanceDbIndex.tableName, computedRows);
    }
    yield 1;
  }
}
