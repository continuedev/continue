import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import {
  Chunk,
  EmbeddingsProvider,
  IndexingProgressUpdate,
  SiteIndexingConfig,
} from "../../index.js";
import { getDocsSqlitePath, getLanceDbPath } from "../../util/paths.js";

import { Article, chunkArticle, pageToArticle } from "./article.js";
import { crawlPage } from "./crawl.js";
import { downloadFromS3, SiteIndexingResults } from "./preIndexed.js";
import { default as configs } from "./preIndexedDocs.js";

// Purposefully lowercase because lancedb converts
interface LanceDbDocsRow {
  title: string;
  baseurl: string;
  // Chunk
  content: string;
  path: string;
  startline: number;
  endline: number;
  vector: number[];
  [key: string]: any;
}

export class DocsService {
  private static instance: DocsService;
  private static DOCS_TABLE_NAME = "docs";
  private _sqliteTable: Database | undefined;

  public static getInstance(): DocsService {
    if (!DocsService.instance) {
      DocsService.instance = new DocsService();
    }
    return DocsService.instance;
  }

  private async getSqliteTable() {
    if (!this._sqliteTable) {
      this._sqliteTable = await open({
        filename: getDocsSqlitePath(),
        driver: sqlite3.Database,
      });

      this._sqliteTable.exec(`CREATE TABLE IF NOT EXISTS docs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title STRING NOT NULL,
          baseUrl STRING NOT NULL UNIQUE
      )`);
    }

    return this._sqliteTable;
  }

  private async getLanceDb() {
    const lancedb = await import("vectordb");
    const lance = await lancedb.connect(getLanceDbPath());
    return lance;
  }

  async retrieve(
    baseUrl: string,
    vector: number[],
    nRetrieve: number,
    embeddingsProviderId: string,
    nested = false,
  ): Promise<Chunk[]> {
    const lance = await this.getLanceDb();
    const db = await this.getSqliteTable();

    const downloadDocs = async () => {
      const config = configs.find((config) => config.startUrl === baseUrl);
      if (config) {
        await this.downloadPreIndexedDocs(embeddingsProviderId, config.title);
        return await this.retrieve(
          baseUrl,
          vector,
          nRetrieve,
          embeddingsProviderId,
          true,
        );
      }
      return undefined;
    };

    const tableNames = await lance.tableNames();
    if (!tableNames.includes(DocsService.DOCS_TABLE_NAME)) {
      const downloaded = await downloadDocs();
      if (downloaded) {
        return downloaded;
      }
    }

    const table = await lance.openTable(DocsService.DOCS_TABLE_NAME);
    let docs: LanceDbDocsRow[] = await table
      .search(vector)
      .limit(nRetrieve)
      .where(`baseurl = '${baseUrl}'`)
      .execute();

    docs = docs.filter((doc) => doc.baseurl === baseUrl);

    if ((!docs || docs.length === 0) && !nested) {
      const downloaded = await downloadDocs();
      if (downloaded) {
        return downloaded;
      }
    }

    return docs.map((doc) => ({
      digest: doc.path,
      filepath: doc.path,
      startLine: doc.startline,
      endLine: doc.endline,
      index: 0,
      content: doc.content,
      otherMetadata: {
        title: doc.title,
      },
    }));
  }

  private async add(
    title: string,
    baseUrl: URL,
    chunks: Chunk[],
    embeddings: number[][],
  ) {
    const data: LanceDbDocsRow[] = chunks.map((chunk, i) => ({
      title: chunk.otherMetadata?.title || title,
      baseurl: baseUrl.toString(),
      content: chunk.content,
      path: chunk.filepath,
      startline: chunk.startLine,
      endline: chunk.endLine,
      vector: embeddings[i],
    }));

    const lance = await this.getLanceDb();
    const tableNames = await lance.tableNames();
    if (!tableNames.includes(DocsService.DOCS_TABLE_NAME)) {
      await lance.createTable(DocsService.DOCS_TABLE_NAME, data);
    } else {
      const table = await lance.openTable(DocsService.DOCS_TABLE_NAME);
      await table.add(data);
    }

    // Only after add it to SQLite
    const db = await this.getSqliteTable();
    await db.run(
      "INSERT INTO docs (title, baseUrl) VALUES (?, ?)",
      title,
      baseUrl.toString(),
    );
  }

  async list(): Promise<{ title: string; baseUrl: string }[]> {
    const db = await this.getSqliteTable();
    const docs = db.all("SELECT title, baseUrl FROM docs");
    return docs;
  }

  async delete(baseUrl: string) {
    const db = await this.getSqliteTable();
    await db.run("DELETE FROM docs WHERE baseUrl = ?", baseUrl);
    const lance = await this.getLanceDb();
    const tableNames = await lance.tableNames();
    if (tableNames.includes(DocsService.DOCS_TABLE_NAME)) {
      const table = await lance.openTable(DocsService.DOCS_TABLE_NAME);
      await table.delete(`baseurl = '${baseUrl}'`);
    }
  }

  async has(baseUrl: string) {
    const db = await this.getSqliteTable();
    const doc = await db.get(
      "SELECT title FROM docs WHERE baseUrl =?",
      baseUrl,
    );
    return !!doc;
  }

  private async downloadPreIndexedDocs(
    embeddingsProviderId: string,
    title: string,
  ) {
    const data = await downloadFromS3(
      "continue-indexed-docs",
      `${embeddingsProviderId}/${title}`,
      "us-west-1",
    );
    const results = JSON.parse(data) as SiteIndexingResults;
    await this.add(
      results.title,
      new URL(results.url),
      results.chunks,
      results.chunks.map((c) => c.embedding),
    );
  }

  async *indexAndAdd(
    siteIndexingConfig: SiteIndexingConfig,
    embeddingsProvider: EmbeddingsProvider,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const startUrl = new URL(siteIndexingConfig.startUrl);

    if (await this.has(siteIndexingConfig.startUrl.toString())) {
      yield {
        progress: 1,
        desc: "Already indexed",
        status: "done",
      };
      return;
    }

    yield {
      progress: 0,
      desc: "Finding subpages",
      status: "indexing",
    };

    const articles: Article[] = [];

    // Crawl pages and retrieve info as articles
    for await (const page of crawlPage(startUrl, siteIndexingConfig.maxDepth)) {
      const article = pageToArticle(page);
      if (!article) {
        continue;
      }
      articles.push(article);

      yield {
        progress: 0,
        desc: `Finding subpages (${page.path})`,
        status: "indexing",
      };
    }

    const chunks: Chunk[] = [];
    const embeddings: number[][] = [];

    // Create embeddings of retrieved articles
    console.log("Creating Embeddings for ", articles.length, " articles");
    for (const article of articles) {
      yield {
        progress: Math.max(1, Math.floor(100 / (articles.length + 1))),
        desc: `${article.subpath}`,
        status: "indexing",
      };

      try {
        const subpathEmbeddings = await embeddingsProvider.embed(
          chunkArticle(article).map((chunk) => {
            chunks.push(chunk);

            return chunk.content;
          }),
        );

        embeddings.push(...subpathEmbeddings);
      } catch (e) {
        console.warn("Error chunking article: ", e);
      }
    }

    // Add docs to databases
    console.log("Adding ", embeddings.length, " embeddings to db");
    await this.add(siteIndexingConfig.title, startUrl, chunks, embeddings);

    yield {
      progress: 1,
      desc: "Done",
      status: "done",
    };
  }
}
