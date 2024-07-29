import {
  Chunk,
  ContinueConfig,
  EmbeddingsProvider,
  IDE,
  IdeInfo,
  IndexingProgressUpdate,
  SiteIndexingConfig,
} from "../../index.js";
import {
  editConfigJson,
  getDocsSqlitePath,
  getLanceDbPath,
} from "../../util/paths.js";
import { Article, chunkArticle, pageToArticle } from "./article.js";
import { crawlPage } from "./crawl.js";
import {
  downloadFromS3,
  getS3Filename,
  S3Buckets,
  SiteIndexingResults,
} from "./preIndexed.js";
import preIndexedDocs from "./preIndexedDocs.js";
import TransformersJsEmbeddingsProvider from "../embeddings/TransformersJsEmbeddingsProvider.js";
import { ConfigHandler } from "../../config/ConfigHandler.js";
import lancedb, { type Table, Connection } from "vectordb";
import { GlobalContext } from "../../util/GlobalContext.js";
import DocsContextProvider from "../../context/providers/DocsContextProvider.js";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

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

type AddParams = {
  title: string;
  baseUrl: string;
  chunks: Chunk[];
  embeddings: number[][];
};

export class DocsService {
  public static preIndexedDocsEmbeddingsProvider =
    new TransformersJsEmbeddingsProvider();

  private static lanceTableName = "docs";
  private static sqlitebTableName = "docs";

  private docsIndexingQueue = new Set<string>();
  private globalContext = new GlobalContext();

  private config!: ContinueConfig;
  private sqliteTable?: Database;

  // If we are instantiating a new DocsService from `getContextItems()`,
  // we have access to the direct config object.
  // When instantiating the DocsService from core, we have access
  // to a ConfigHandler instance.
  constructor(
    config: ConfigHandler | ContinueConfig,
    private readonly ide: IDE,
  ) {
    if (config instanceof ConfigHandler) {
      this.loadConfigAndInitListener(config);
    } else {
      this.config = config;
    }
  }

  public async isJetBrainsAndPreIndexedDocsProvider(): Promise<boolean> {
    const isJetBrains = await this.isJetBrains();

    const isPreIndexedDocsProvider =
      this.config.embeddingsProvider.id ===
      DocsService.preIndexedDocsEmbeddingsProvider.id;

    return isJetBrains && isPreIndexedDocsProvider;
  }

  /*
   * Currently, we generate and host embeddings for pre-indexed docs using transformers.js.
   * However, we don't ship transformers.js with the JetBrains extension.
   * So, we only include pre-indexed docs in the submenu for non-JetBrains IDEs.
   */
  public async canUsePreindexedDocs() {
    const isJetBrains = await this.isJetBrains();
    return !isJetBrains;
  }

  public async indexAllDocs(reIndex: boolean = false) {
    if (!this.hasDocsContextProvider()) {
      this.ide.infoPopup(
        "No 'docs' provider configured under 'contextProviders' in config.json",
      );
      return;
    }

    if (!this.config.docs || this.config.docs.length === 0) {
      this.ide.infoPopup("No entries found under 'docs' in config.json");
      return;
    }

    for (const site of this.config.docs) {
      const generator = this.indexAndAdd(site, reIndex);
      while (!(await generator.next()).done) {}
    }

    this.ide.infoPopup("Docs indexing completed");
  }

  private async syncConfigAndSqlite(config: ContinueConfig) {
    const sqliteDocs = await this.list();
    const sqliteDocStartUrls = sqliteDocs.map((doc) => doc.baseUrl) || [];

    const configDocs = config.docs || [];
    const configDocStartUrls = config.docs?.map((doc) => doc.startUrl) || [];

    const newDocs = configDocs.filter(
      (doc) => !sqliteDocStartUrls.includes(doc.startUrl),
    );
    const deletedDocs = sqliteDocs.filter(
      (doc) => !configDocStartUrls.includes(doc.baseUrl),
    );

    for (const doc of newDocs) {
      console.log(`Indexing new doc: ${doc.startUrl}`);
      const generator = this.indexAndAdd(doc);
      while (!(await generator.next()).done) {}
    }

    for (const doc of deletedDocs) {
      console.log(`Deleting doc: ${doc.baseUrl}`);
      await this.delete(doc.baseUrl);
    }
  }

  private async loadConfigAndInitListener(configHandler: ConfigHandler) {
    this.config = await configHandler.loadConfig();

    configHandler.onConfigUpdate(async (newConfig) => {
      const oldConfig = this.config;

      // Need to update class property for config at the beginning of this callback
      // to ensure downstream methods have access to the latest config.
      this.config = newConfig;

      if (oldConfig.docs !== newConfig.docs) {
        await this.syncConfigAndSqlite(newConfig);
      }

      const shouldReindex = await this.shouldReindexDocsOnNewEmbeddingsProvider(
        newConfig.embeddingsProvider.id,
      );

      if (shouldReindex) {
        await this.reindexDocsOnNewEmbeddingsProvider(
          newConfig.embeddingsProvider,
        );
      }
    });
  }

  private hasDocsContextProvider() {
    return !!this.config.contextProviders?.some(
      (provider) =>
        provider.description.title === DocsContextProvider.description.title,
    );
  }

  private async getOrCreateSqliteDb() {
    if (!this.sqliteTable) {
      this.sqliteTable = await open({
        filename: getDocsSqlitePath(),
        driver: sqlite3.Database,
      });

      this.sqliteTable
        .exec(`CREATE TABLE IF NOT EXISTS ${DocsService.sqlitebTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title STRING NOT NULL,
            baseUrl STRING NOT NULL UNIQUE
        )`);
    }

    return this.sqliteTable;
  }

  private async createLanceDocsTable(
    connection: Connection,
    initializationVector: number[],
  ) {
    const mockRowTitle = "mockRowTitle";
    const mockRow: LanceDbDocsRow[] = [
      {
        title: mockRowTitle,
        vector: initializationVector,
        baseurl: "",
        content: "",
        path: "",
        startline: 0,
        endline: 0,
      },
    ];

    const table = await connection.createTable(
      DocsService.lanceTableName,
      mockRow,
    );

    await table.delete(`title = '${mockRowTitle}'`);
  }

  private async getOrCreateLanceTable(initializationVector?: number[]) {
    const connection = await lancedb.connect(getLanceDbPath());
    const tableNames = await connection.tableNames();

    if (!tableNames.includes(DocsService.lanceTableName)) {
      if (initializationVector) {
        await this.createLanceDocsTable(connection, initializationVector);
      } else {
        console.error(
          "No existing Lance DB docs table was found and no initialization " +
            "vector was passed to create one",
        );
      }
    }

    const table = await connection.openTable(DocsService.lanceTableName);

    return table;
  }

  public async getEmbeddingsProvider(isPreIndexedDoc: boolean = false) {
    const canUsePreindexedDocs = await this.canUsePreindexedDocs();

    if (isPreIndexedDoc && !canUsePreindexedDocs) {
      return DocsService.preIndexedDocsEmbeddingsProvider;
    }

    return this.config.embeddingsProvider;
  }

  private async isJetBrains() {
    const ideInfo = await this.ide.getIdeInfo();
    return ideInfo.ideType === "jetbrains";
  }

  private async hasIndexedDoc(baseUrl: string) {
    const db = await this.getOrCreateSqliteDb();
    const docs = await db.all(
      `SELECT baseUrl FROM ${DocsService.sqlitebTableName} WHERE baseUrl = ?`,
      baseUrl,
    );

    return docs.length > 0;
  }

  async retrieveEmbeddings(
    baseUrl: string,
    vector: number[],
    nRetrieve: number,
    isRetry: boolean = false,
  ): Promise<Chunk[]> {
    const table = await this.getOrCreateLanceTable(vector);

    const docs: LanceDbDocsRow[] = await table
      .search(vector)
      .limit(nRetrieve)
      .where(`baseurl = '${baseUrl}'`)
      .execute();

    const hasIndexedDoc = await this.hasIndexedDoc(baseUrl);

    if (!hasIndexedDoc && docs.length === 0) {
      const preIndexedDoc = preIndexedDocs[baseUrl];

      if (isRetry || !preIndexedDoc) {
        return [];
      }

      await this.fetchAndAddPreIndexedDocEmbeddings(preIndexedDoc.title);
      return await this.retrieveEmbeddings(baseUrl, vector, nRetrieve, true);
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

  private async addToLance({ chunks, baseUrl, title, embeddings }: AddParams) {
    const sampleVector = embeddings[0];
    const table = await this.getOrCreateLanceTable(sampleVector);

    const rows: LanceDbDocsRow[] = chunks.map((chunk, i) => ({
      vector: embeddings[i],
      baseurl: baseUrl,
      title: chunk.otherMetadata?.title || title,
      content: chunk.content,
      path: chunk.filepath,
      startline: chunk.startLine,
      endline: chunk.endLine,
    }));

    await table.add(rows);
  }

  private async addToSqlite({ title, baseUrl }: AddParams) {
    const db = await this.getOrCreateSqliteDb();
    await db.run(
      `INSERT INTO ${DocsService.sqlitebTableName} (title, baseUrl) VALUES (?, ?)`,
      title,
      baseUrl,
    );
  }

  private addToConfig({ title, baseUrl }: AddParams) {
    const newDoc = { title, startUrl: baseUrl, rootUrl: baseUrl };

    // Handles the case where a user has manually added the doc to config.json
    // so it already exists in the file
    const doesDocExist = this.config.docs?.some(
      (doc) => doc.startUrl === newDoc.startUrl,
    );

    if (!doesDocExist) {
      editConfigJson((config) => ({
        ...config,
        docs: [...(config.docs ?? []), newDoc],
      }));
    }
  }

  private async add(params: AddParams) {
    await this.addToLance(params);
    await this.addToSqlite(params);

    if (!preIndexedDocs[params.baseUrl]) {
      this.addToConfig(params);
    }
  }

  async list() {
    const db = await this.getOrCreateSqliteDb();
    const docs = db.all(
      `SELECT title, baseUrl FROM ${DocsService.sqlitebTableName}`,
    );

    return docs;
  }

  async deleteFromLance(startUrl: string) {
    const lanceTable = await this.getOrCreateLanceTable();
    await lanceTable.delete(`baseurl = '${startUrl}'`);
  }

  async deleteFromSqlite(startUrl: string) {
    const db = await this.getOrCreateSqliteDb();
    await db.run(
      `DELETE FROM ${DocsService.sqlitebTableName} WHERE baseUrl = ?`,
      startUrl,
    );
  }

  deleteFromConfig(startUrl: string) {
    editConfigJson((config) => ({
      ...config,
      docs: config.docs?.filter((doc) => doc.startUrl !== startUrl) || [],
    }));
  }

  async delete(startUrl: string) {
    await this.deleteFromLance(startUrl);
    await this.deleteFromSqlite(startUrl);
    this.deleteFromConfig(startUrl);
  }

  async has(startUrl: string): Promise<Promise<boolean>> {
    const db = await this.getOrCreateSqliteDb();
    const doc = await db.get(
      `SELECT title FROM ${DocsService.sqlitebTableName} WHERE baseUrl = ?`,
      startUrl,
    );

    return !!doc;
  }

  private async fetchAndAddPreIndexedDocEmbeddings(title: string) {
    const embeddingsProvider = await this.getEmbeddingsProvider(true);

    const data = await downloadFromS3(
      S3Buckets.continueIndexedDocs,
      getS3Filename(embeddingsProvider.id, title),
    );

    const siteEmbeddings = JSON.parse(data) as SiteIndexingResults;
    const baseUrl = new URL(siteEmbeddings.url).toString();

    await this.add({
      baseUrl,
      title: siteEmbeddings.title,
      chunks: siteEmbeddings.chunks,
      embeddings: siteEmbeddings.chunks.map((c) => c.embedding),
    });
  }

  async *indexAndAdd(
    siteIndexingConfig: SiteIndexingConfig,
    reIndex: boolean = false,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const embeddingsProvider = await this.getEmbeddingsProvider();
    const startUrl = new URL(siteIndexingConfig.startUrl.toString());
    const startUrlStr = startUrl.toString();

    if (this.docsIndexingQueue.has(startUrlStr)) {
      console.log("Already in queue");
      return;
    }

    if (!reIndex && (await this.has(startUrlStr))) {
      yield {
        progress: 1,
        desc: "Already indexed",
        status: "done",
      };
      return;
    }

    // Mark the site as currently being indexed
    this.docsIndexingQueue.add(startUrlStr);

    yield {
      progress: 0,
      desc: "Finding subpages",
      status: "indexing",
    };

    const articles: Article[] = [];
    let processedPages = 0;
    let maxKnownPages = 1;

    // Crawl pages and retrieve info as articles
    for await (const page of crawlPage(startUrl, siteIndexingConfig.maxDepth)) {
      processedPages++;
      const article = pageToArticle(page);
      if (!article) {
        continue;
      }
      articles.push(article);

      // Use a heuristic approach for progress calculation
      const progress = Math.min(processedPages / maxKnownPages, 1);

      yield {
        progress, // Yield the heuristic progress
        desc: `Finding subpages (${page.path})`,
        status: "indexing",
      };

      // Increase maxKnownPages to delay progress reaching 100% too soon
      if (processedPages === maxKnownPages) {
        maxKnownPages *= 2;
      }
    }

    const chunks: Chunk[] = [];
    const embeddings: number[][] = [];

    // Create embeddings of retrieved articles
    console.log(`Creating embeddings for ${articles.length} articles`);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      yield {
        progress: i / articles.length,
        desc: `Creating Embeddings: ${article.subpath}`,
        status: "indexing",
      };

      try {
        const subpathEmbeddings = await embeddingsProvider.embed(
          chunkArticle(article, embeddingsProvider.maxChunkSize).map(
            (chunk) => {
              chunks.push(chunk);

              return chunk.content;
            },
          ),
        );

        embeddings.push(...subpathEmbeddings);
      } catch (e) {
        console.warn("Error chunking article: ", e);
      }
    }

    // Add docs to databases
    console.log(`Adding ${embeddings.length} embeddings to db`);

    yield {
      progress: 0.5,
      desc: `Adding ${embeddings.length} embeddings to db`,
      status: "indexing",
    };

    // Clear old index if re-indexing.
    if (reIndex) {
      console.log("Deleting old embeddings");
      await this.delete(startUrlStr);
    }

    await this.add({
      chunks,
      embeddings,
      title: siteIndexingConfig.title,
      baseUrl: startUrlStr,
    });

    this.docsIndexingQueue.delete(startUrlStr);

    yield {
      progress: 1,
      desc: "Done",
      status: "done",
    };

    console.log(`Successfully indexed: ${siteIndexingConfig.startUrl}`);
  }

  private async shouldReindexDocsOnNewEmbeddingsProvider(
    curEmbeddingsProviderId: EmbeddingsProvider["id"],
  ): Promise<boolean> {
    const isJetBrainsAndPreIndexedDocsProvider =
      await this.isJetBrainsAndPreIndexedDocsProvider();

    if (isJetBrainsAndPreIndexedDocsProvider) {
      this.ide.errorPopup(
        "The 'transformers.js' embeddings provider currently cannot be used to index " +
          "documentation in JetBrains. To enable documentation indexing, you can use " +
          "any of the other providers described in the docs: " +
          "https://docs.continue.dev/walkthroughs/codebase-embeddings#embeddings-providers",
      );

      this.globalContext.update(
        "curEmbeddingsProviderId",
        curEmbeddingsProviderId,
      );

      return false;
    }

    const lastEmbeddingsProviderId = this.globalContext.get(
      "curEmbeddingsProviderId",
    );

    if (!lastEmbeddingsProviderId) {
      // If it's the first time we're setting the `curEmbeddingsProviderId`
      // global state, we don't need to reindex docs
      this.globalContext.update(
        "curEmbeddingsProviderId",
        curEmbeddingsProviderId,
      );

      return false;
    }

    return lastEmbeddingsProviderId !== curEmbeddingsProviderId;
  }

  /**
   * Currently this deletes re-crawls + re-indexes all docs.
   * A more optimal solution in the future will be to create
   * a per-embeddings-provider table for docs.
   */
  private async reindexDocsOnNewEmbeddingsProvider(
    embeddingsProvider: EmbeddingsProvider,
  ) {
    const docs = await this.list();

    if (!docs || docs.length === 0) {
      return;
    }

    this.ide.infoPopup("Reindexing docs with new embeddings provider");

    for (const { title, baseUrl } of docs) {
      await this.delete(baseUrl);

      const generator = this.indexAndAdd({
        title,
        startUrl: baseUrl,
        rootUrl: baseUrl,
      });

      while (!(await generator.next()).done) {}
    }

    // Important that this only is invoked after we have successfully
    // cleared and reindex the docs so that the table cannot end up in an
    // invalid state.
    this.globalContext.update("curEmbeddingsProviderId", embeddingsProvider.id);

    this.ide.infoPopup("Completed reindexing of all docs");
  }
}
