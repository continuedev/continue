import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import lancedb, { Connection } from "vectordb";

import {
  Chunk,
  ContinueConfig,
  IDE,
  IdeInfo,
  ILLM,
  IndexingStatus,
  SiteIndexingConfig,
} from "../..";
import { ConfigHandler } from "../../config/ConfigHandler";
import { addContextProvider } from "../../config/util";
import DocsContextProvider from "../../context/providers/DocsContextProvider";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import { fetchFavicon, getFaviconBase64 } from "../../util/fetchFavicon";
import { GlobalContext } from "../../util/GlobalContext";
import { IMessenger } from "../../protocol/messenger";
import {
  editConfigJson,
  getDocsSqlitePath,
  getLanceDbPath,
} from "../../util/paths";
import { Telemetry } from "../../util/posthog";

import { Article, chunkArticle, pageToArticle } from "./article";
import DocsCrawler from "./DocsCrawler";
import { runLanceMigrations, runSqliteMigrations } from "./migrations";
import {
  downloadFromS3,
  getS3Filename,
  S3Buckets,
  SiteIndexingResults,
} from "./preIndexed";
import preIndexedDocs from "./preIndexedDocs";

// Purposefully lowercase because lancedb converts
export interface LanceDbDocsRow {
  title: string;
  starturl: string;
  // Chunk
  content: string;
  path: string;
  startline: number;
  endline: number;
  vector: number[];
  [key: string]: any;
}

export interface SqliteDocsRow {
  title: string;
  startUrl: string;
  favicon: string;
}

export type AddParams = {
  siteIndexingConfig: SiteIndexingConfig;
  chunks: Chunk[];
  embeddings: number[][];
  favicon?: string;
};

/*
  General process:
  - On config update:
    - Reindex ALL docs if embeddings provider has changed
    - Otherwise, reindex docs with CHANGED URL/DEPTH
    - And update docs with CHANGED TITLE/FAVICON
  - Also, messages to core can trigger:
    - delete
    - reindex all
    - add/index one
  - Currently a full reindex deletes all docs rather than storing PER embeddings provider
  - The last successful embeddings provider is stored in global context and updated AFTER an indexing process is successful
*/
export default class DocsService {
  static lanceTableName = "docs";
  static sqlitebTableName = "docs";

  static preIndexedDocsEmbeddingsProvider =
    new TransformersJsEmbeddingsProvider();

  public isInitialized: Promise<void>;
  public isSyncing: boolean = false;

  private docsIndexingQueue = new Set<string>();
  private globalContext = new GlobalContext();
  private lanceTableNamesSet = new Set<string>();

  private config!: ContinueConfig;
  private sqliteDb?: Database;

  private docsCrawler!: DocsCrawler;
  private ideInfoPromise: Promise<IdeInfo>;

  constructor(
    configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly messenger?: IMessenger<ToCoreProtocol, FromCoreProtocol>,
  ) {
    this.ideInfoPromise = this.ide.getIdeInfo();
    this.isInitialized = this.init(configHandler);
  }

  // Singleton pattern: only one service globally
  private static instance?: DocsService;
  static createSingleton(
    configHandler: ConfigHandler,
    ide: IDE,
    messenger?: IMessenger<ToCoreProtocol, FromCoreProtocol>,
  ) {
    const docsService = new DocsService(configHandler, ide, messenger);
    DocsService.instance = docsService;
    return docsService;
  }

  static getSingleton() {
    return DocsService.instance;
  }

  // Initialization - load config and attach config listener
  private async init(configHandler: ConfigHandler) {
    const config = await configHandler.loadConfig();
    await this.handleConfigUpdate({ config });
    configHandler.onConfigUpdate(this.handleConfigUpdate.bind(this));
  }

  readonly statuses: Map<string, IndexingStatus> = new Map();

  handleStatusUpdate(update: IndexingStatus) {
    this.statuses.set(update.id, update);
    this.messenger?.send("indexing/statusUpdate", update);
  }

  // A way for gui to retrieve initial statuses
  async initStatuses(): Promise<void> {
    if (!this.config?.docs) {
      return;
    }
    const metadata = await this.listMetadata();

    this.config.docs?.forEach((doc) => {
      if (!doc.startUrl) {
        console.error("Invalid config docs entry, no start");
        return;
      }

      const currentStatus = this.statuses.get(doc.startUrl);
      if (currentStatus) {
        return currentStatus;
      }

      const sharedStatus = {
        type: "docs" as IndexingStatus["type"],
        id: doc.startUrl,
        embeddingsProviderId: this.config.embeddingsProvider.embeddingId,
        isReindexing: false,
        title: doc.title,
        debugInfo: `max depth: ${doc.maxDepth}`,
        icon: doc.faviconUrl,
        url: doc.startUrl,
      };
      const indexedStatus: IndexingStatus = metadata.find(
        (meta) => meta.startUrl === doc.startUrl,
      )
        ? {
            ...sharedStatus,
            progress: 0,
            description: "Pending",
            status: "pending",
          }
        : {
            ...sharedStatus,
            progress: 1,
            description: "Complete",
            status: "complete",
          };
      this.handleStatusUpdate(indexedStatus);
    });
  }

  abort(startUrl: string) {
    const status = this.statuses.get(startUrl);
    if (status) {
      this.docsIndexingQueue.delete(startUrl);
      this.handleStatusUpdate({
        ...status,
        status: "aborted",
        progress: 0,
        description: "Canceled",
      });
    }
  }

  isAborted(startUrl: string) {
    return this.statuses.get(startUrl)?.status === "aborted";
  }

  // NOTE Pausing not supported for docs yet
  // setPaused(startUrl: string, pause: boolean) {
  //   const status = this.statuses.get(startUrl);
  //   if (status) {
  //     this.handleStatusUpdate({
  //       ...status,
  //       status: pause ? "paused" : "indexing",
  //     });
  //   }
  // }

  // isPaused(startUrl: string) {
  //   return this.statuses.get(startUrl)?.status === "paused";
  // }

  /*
   * Currently, we generate and host embeddings for pre-indexed docs using transformers.
   * However, we don't ship transformers with the JetBrains extension.
   * So, we only include pre-indexed docs in the submenu for non-JetBrains IDEs.
   */
  async canUsePreindexedDocs() {
    const ideInfo = await this.ideInfoPromise;
    if (ideInfo.ideType === "jetbrains") {
      return false;
    }
    return true;
  }

  async isUsingUnsupportedPreIndexedEmbeddingsProvider() {
    const isPreIndexedDocsProvider =
      this.config.embeddingsProvider.embeddingId ===
      DocsService.preIndexedDocsEmbeddingsProvider.embeddingId;
    const canUsePreindexedDocs = await this.canUsePreindexedDocs();
    return isPreIndexedDocsProvider && !canUsePreindexedDocs;
  }

  async getEmbeddingsProvider(isPreIndexedDoc: boolean = false): Promise<ILLM> {
    const canUsePreindexedDocs = await this.canUsePreindexedDocs();

    if (canUsePreindexedDocs && isPreIndexedDoc) {
      return DocsService.preIndexedDocsEmbeddingsProvider;
    }

    return this.config.embeddingsProvider;
  }

  private async handleConfigUpdate({
    config: newConfig,
  }: {
    config: ContinueConfig | undefined;
  }) {
    if (newConfig) {
      const oldConfig = this.config;
      this.config = newConfig; // IMPORTANT - need to set up top, other methods below use this without passing it in

      this.docsCrawler = new DocsCrawler(this.ide, newConfig);

      // Skip docs indexing if not supported
      const unsupported =
        await this.isUsingUnsupportedPreIndexedEmbeddingsProvider();
      if (unsupported) {
        return;
      }

      await this.syncOrReindexAllDocs(newConfig, oldConfig);
    }
  }

  private async syncOrReindexAllDocs(
    newConfig: ContinueConfig,
    oldConfig?: ContinueConfig,
  ) {
    // On embeddings provider change, reindex all non-preindexed docs
    // change = doesn't match last successful embeddings provider
    const curEmbeddingsProviderId = this.globalContext.get(
      "curEmbeddingsProviderId",
    );
    if (
      !curEmbeddingsProviderId ||
      curEmbeddingsProviderId !== newConfig.embeddingsProvider.embeddingId
    ) {
      // If not set, we're initializing
      const currentDocs = await this.listMetadata();
      if (currentDocs.length > 0) {
        await this.reindexDocsOnNewEmbeddingsProvider();
        return;
      }
    }

    await this.syncDocsOnConfigUpdate(oldConfig, newConfig);
  }

  async syncOrReindexAllDocsWithPrompt(reIndex: boolean = false) {
    if (!this.hasDocsContextProvider()) {
      const didAddDocsContextProvider =
        await this.showAddDocsContextProviderToast();

      if (!didAddDocsContextProvider) {
        return;
      }
    }

    await this.syncOrReindexAllDocs(this.config);

    void this.ide.showToast("info", "Docs indexing completed");
  }

  async hasMetadata(startUrl: string): Promise<Promise<boolean>> {
    const db = await this.getOrCreateSqliteDb();
    const title = await db.get(
      `SELECT title FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );

    return !!title;
  }

  async showAddDocsContextProviderToast() {
    const actionMsg = "Add 'docs' context provider";
    const res = await this.ide.showToast(
      "info",
      "Starting docs indexing",
      actionMsg,
    );

    if (res === actionMsg) {
      addContextProvider({
        name: DocsContextProvider.description.title,
        params: {},
      });

      void this.ide.showToast(
        "info",
        "Successfuly added docs context provider",
      );
    }

    return res === actionMsg;
  }

  async listMetadata() {
    const db = await this.getOrCreateSqliteDb();
    const docs = await db.all<SqliteDocsRow[]>(
      `SELECT title, startUrl, favicon FROM ${DocsService.sqlitebTableName}`,
    );

    return docs;
  }

  async reindexDoc(startUrl: string) {
    const docConfig = this.config.docs?.find(
      (doc) => doc.startUrl === startUrl,
    );
    if (docConfig) {
      await this.indexAndAdd(docConfig, true);
    }
  }

  async indexAndAdd(
    siteIndexingConfig: SiteIndexingConfig,
    reIndex: boolean = false,
  ): Promise<void> {
    const { startUrl } = siteIndexingConfig;

    // Queue - indexAndAdd is invoked circularly by config edits. This prevents duplicate runs
    if (this.docsIndexingQueue.has(startUrl)) {
      return;
    }

    const embeddingsProvider = await this.getEmbeddingsProvider();

    this.docsIndexingQueue.add(startUrl);

    const indexExists = await this.hasMetadata(startUrl);

    // Build status update - most of it is fixed values
    const fixedStatus: Omit<
      IndexingStatus,
      "progress" | "description" | "status"
    > = {
      type: "docs",
      id: siteIndexingConfig.startUrl,
      embeddingsProviderId: embeddingsProvider.embeddingId,
      isReindexing: reIndex && indexExists,
      title: siteIndexingConfig.title,
      debugInfo: `max depth: ${siteIndexingConfig.maxDepth}`,
      icon: siteIndexingConfig.faviconUrl,
      url: siteIndexingConfig.startUrl,
    };

    // Clear current indexes if reIndexing
    if (indexExists) {
      if (reIndex) {
        await this.deleteIndexes(startUrl);
      } else {
        this.handleStatusUpdate({
          ...fixedStatus,
          progress: 1,
          description: "Complete",
          status: "complete",
          debugInfo: "Already indexed",
        });
        return;
      }
    }

    // If not preindexed
    const isPreIndexedDoc = !!preIndexedDocs[siteIndexingConfig.startUrl];
    if (!isPreIndexedDoc) {
      this.addToConfig(siteIndexingConfig);
    }

    try {
      this.handleStatusUpdate({
        ...fixedStatus,
        status: "indexing",
        description: "Finding subpages",
        progress: 0,
      });

      const articles: Article[] = [];
      let processedPages = 0;
      let estimatedProgress = 0;

      // Crawl pages and retrieve info as articles
      for await (const page of this.docsCrawler.crawl(new URL(startUrl))) {
        estimatedProgress += 1 / 2 ** (processedPages + 1);

        // NOTE - during "indexing" phase, check if aborted before each status update
        if (this.isAborted(startUrl)) {
          return;
        }
        this.handleStatusUpdate({
          ...fixedStatus,
          description: `Finding subpages (${page.path})`,
          status: "indexing",
          progress:
            0.15 * estimatedProgress +
            Math.min(0.35, (0.35 * processedPages) / 500),
          // For the first 50%, 15% is sum of series 1/(2^n) and the other 35% is based on number of files/ 500 max
        });

        const article = pageToArticle(page);
        if (!article) {
          continue;
        }
        articles.push(article);

        processedPages++;

        // Locks down GUI if no sleeping
        // Wait proportional to how many docs are indexing
        const toWait = 100 * this.docsIndexingQueue.size + 50;
        await new Promise((resolve) => setTimeout(resolve, toWait));
      }

      void Telemetry.capture("docs_pages_crawled", {
        count: processedPages,
      });

      const chunks: Chunk[] = [];
      const embeddings: number[][] = [];

      // Create embeddings of retrieved articles
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];

        if (this.isAborted(startUrl)) {
          return;
        }
        this.handleStatusUpdate({
          ...fixedStatus,
          status: "indexing",
          description: `Creating Embeddings: ${article.subpath}`,
          progress: 0.5 + 0.3 * (i / articles.length), // 50% -> 80%
        });

        try {
          const chunkedArticle = chunkArticle(
            article,
            embeddingsProvider.maxEmbeddingChunkSize,
          );

          const chunkedArticleContents = chunkedArticle.map(
            (chunk) => chunk.content,
          );

          chunks.push(...chunkedArticle);

          const subpathEmbeddings = await embeddingsProvider.embed(
            chunkedArticleContents,
          );

          embeddings.push(...subpathEmbeddings);
        } catch (e) {
          console.warn("Error chunking article: ", e);
        }
      }

      if (embeddings.length === 0) {
        console.error(
          `No embeddings were created for site: ${siteIndexingConfig.startUrl}\n Num chunks: ${chunks.length}`,
        );

        if (this.isAborted(startUrl)) {
          return;
        }
        this.handleStatusUpdate({
          ...fixedStatus,
          description: `No embeddings were created for site: ${siteIndexingConfig.startUrl}`,
          status: "failed",
          progress: 1,
        });

        void this.ide.showToast("info", `Failed to index ${startUrl}`);
        this.docsIndexingQueue.delete(startUrl);
        return;
      }

      // Add docs to databases
      console.log(`Adding ${embeddings.length} embeddings to db`);

      if (this.isAborted(startUrl)) {
        return;
      }
      this.handleStatusUpdate({
        ...fixedStatus,
        description: "Deleting old embeddings from the db",
        status: "indexing",
        progress: 0.8,
      });

      // Delete indexed docs if re-indexing
      if (reIndex && indexExists) {
        console.log("Deleting old embeddings");
        await this.deleteIndexes(startUrl);
      }

      const favicon = await fetchFavicon(new URL(siteIndexingConfig.startUrl));

      if (this.isAborted(startUrl)) {
        return;
      }
      this.handleStatusUpdate({
        ...fixedStatus,
        description: `Adding ${embeddings.length} embeddings to db`,
        status: "indexing",
        progress: 0.85,
      });

      await this.add({
        siteIndexingConfig,
        chunks,
        embeddings,
        favicon,
      });

      this.docsIndexingQueue.delete(startUrl);

      if (this.isAborted(startUrl)) {
        return;
      }
      this.handleStatusUpdate({
        ...fixedStatus,
        description: "Complete",
        status: "complete",
        progress: 1,
      });

      void this.ide.showToast("info", `Successfully indexed ${startUrl}`);

      if (this.messenger) {
        this.messenger.send("refreshSubmenuItems", undefined);
      }
    } catch (e) {
      console.error("Error indexing docs", e);
      this.handleStatusUpdate({
        ...fixedStatus,
        description: `No embeddings were created for site: ${siteIndexingConfig.startUrl}`,
        status: "failed",
        progress: 1,
      });
    } finally {
      this.docsIndexingQueue.delete(startUrl);
    }
  }

  // When user requests a pre-indexed doc for the first time
  // And pre-indexed embeddings are supported
  // Fetch pre-indexed embeddings from S3, add to Lance, and then search those
  private async fetchAndAddPreIndexedDocEmbeddings(title: string) {
    const embeddingsProvider = await this.getEmbeddingsProvider(true);

    const data = await downloadFromS3(
      S3Buckets.continueIndexedDocs,
      getS3Filename(embeddingsProvider.embeddingId, title),
    );

    const siteEmbeddings = JSON.parse(data) as SiteIndexingResults;
    const startUrl = new URL(siteEmbeddings.url).toString();

    const faviconUrl = preIndexedDocs[startUrl].faviconUrl;
    const favicon =
      typeof faviconUrl === "string"
        ? await getFaviconBase64(faviconUrl)
        : undefined;

    await this.add({
      favicon,
      siteIndexingConfig: {
        startUrl,
        title: siteEmbeddings.title,
      },
      chunks: siteEmbeddings.chunks,
      embeddings: siteEmbeddings.chunks.map((c) => c.embedding),
    });
  }

  // Retrieve docs embeds based on user input
  async retrieveChunksFromQuery(
    query: string,
    startUrl: string,
    nRetrieve: number,
  ) {
    if (await this.isUsingUnsupportedPreIndexedEmbeddingsProvider()) {
      await this.ide.showToast(
        "error",
        `${DocsService.preIndexedDocsEmbeddingsProvider.embeddingId} is configured as ` +
          "the embeddings provider, but it cannot be used with JetBrains. " + // TODO "with this IDE"
          "Please select a different embeddings provider to use the '@docs' " +
          "context provider.",
      );

      return [];
    }

    const preIndexedDoc = preIndexedDocs[startUrl];
    if (!!preIndexedDoc) {
      void Telemetry.capture("docs_pre_indexed_doc_used", {
        doc: preIndexedDoc["title"],
      });
    }

    const embeddingsProvider =
      await this.getEmbeddingsProvider(!!preIndexedDoc);

    const [vector] = await embeddingsProvider.embed([query]);

    return await this.retrieveChunks(startUrl, vector, nRetrieve);
  }

  async retrieveChunks(
    startUrl: string,
    vector: number[],
    nRetrieve: number,
    isRetry: boolean = false,
  ): Promise<Chunk[]> {
    const isPreIndexedDoc = !!preIndexedDocs[startUrl];
    const table = await this.getOrCreateLanceTable({
      initializationVector: vector,
      isPreIndexedDoc,
    });

    let docs: LanceDbDocsRow[] = [];
    try {
      docs = await table
        .search(vector)
        .limit(nRetrieve)
        .where(`starturl = '${startUrl}'`)
        .execute();
    } catch (e: any) {
      console.warn("Error retrieving chunks from LanceDB", e);
    }

    const hasIndexedDoc = await this.hasMetadata(startUrl);

    if (!hasIndexedDoc && docs.length === 0) {
      const preIndexedDoc = preIndexedDocs[startUrl];

      if (isRetry || !preIndexedDoc) {
        return [];
      }

      await this.fetchAndAddPreIndexedDocEmbeddings(preIndexedDoc.title);
      return await this.retrieveChunks(startUrl, vector, nRetrieve, true);
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

  // SQLITE DB
  private async getOrCreateSqliteDb() {
    if (!this.sqliteDb) {
      const db = await open({
        filename: getDocsSqlitePath(),
        driver: sqlite3.Database,
      });

      await db.exec("PRAGMA busy_timeout = 3000;");

      await runSqliteMigrations(db);

      await db.exec(`CREATE TABLE IF NOT EXISTS ${DocsService.sqlitebTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title STRING NOT NULL,
            startUrl STRING NOT NULL UNIQUE,
            favicon STRING
        )`);

      this.sqliteDb = db;
    }

    return this.sqliteDb;
  }

  async getFavicon(startUrl: string) {
    const db = await this.getOrCreateSqliteDb();
    const result = await db.get(
      `SELECT favicon FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );

    if (!result) {
      return;
    }
    return result.favicon;
  }

  /*
    Sync with no embeddings provider change
    Ignores pre-indexed docs
  */
  private async syncDocsOnConfigUpdate(
    oldConfig: ContinueConfig | undefined,
    newConfig: ContinueConfig,
  ) {
    try {
      this.isSyncing = true;

      // Otherwise sync the index based on config changes
      const oldConfigDocs = oldConfig?.docs || [];
      const newConfigDocs = newConfig.docs || [];
      const newConfigStartUrls = newConfigDocs.map((doc) => doc.startUrl);

      const currentlyIndexedDocs = await this.listMetadata();
      const currentStartUrls = currentlyIndexedDocs.map((doc) => doc.startUrl);

      // Anything found in sqlite but not in new config should be deleted if not preindexed
      const deletedDocs = currentlyIndexedDocs.filter(
        (doc) =>
          !preIndexedDocs[doc.startUrl] &&
          !newConfigStartUrls.includes(doc.startUrl),
      );

      // Anything found in old config, new config, AND sqlite that doesn't match should be reindexed
      // TODO if only favicon and title change, only update, don't embed
      // Otherwise anything found in new config that isn't in sqlite should be added/indexed
      const newDocs: SiteIndexingConfig[] = [];
      const changedDocs: SiteIndexingConfig[] = [];
      for (const doc of newConfigDocs) {
        const currentIndexedDoc = currentStartUrls.includes(doc.startUrl);

        if (currentIndexedDoc) {
          const oldConfigDoc = oldConfigDocs.find(
            (d) => d.startUrl === doc.startUrl,
          );
          if (
            oldConfigDoc &&
            (oldConfigDoc.maxDepth !== doc.maxDepth ||
              oldConfigDoc.title !== doc.title ||
              oldConfigDoc.faviconUrl !== doc.faviconUrl)
          ) {
            changedDocs.push(doc);
          } else {
            // if get's here, not changed, no update needed, mark as complete
            this.handleStatusUpdate({
              type: "docs",
              id: doc.startUrl,
              embeddingsProviderId: this.config.embeddingsProvider.embeddingId,
              isReindexing: false,
              title: doc.title,
              debugInfo: "Config sync: not changed",
              icon: doc.faviconUrl,
              url: doc.startUrl,
              progress: 1,
              description: "Complete",
              status: "complete",
            });
          }
        } else {
          newDocs.push(doc);
        }
      }

      await Promise.allSettled([
        ...changedDocs.map((doc) => this.indexAndAdd(doc, true)),
        ...newDocs.map((doc) => this.indexAndAdd(doc)),
      ]);

      for (const doc of newDocs) {
        void Telemetry.capture("add_docs_config", { url: doc.startUrl });
      }

      for (const doc of deletedDocs) {
        await this.deleteIndexes(doc.startUrl);
      }
    } catch (e) {
      console.error("Error syncing docs index on config update", e);
    } finally {
      this.isSyncing = false;
    }
  }

  private hasDocsContextProvider() {
    return !!this.config.contextProviders?.some(
      (provider) =>
        provider.description.title === DocsContextProvider.description.title,
    );
  }

  // Lance DB Initialization
  private async createLanceDocsTable(
    connection: Connection,
    initializationVector: number[],
    tableName: string,
  ) {
    const mockRowTitle = "mockRowTitle";
    const mockRow: LanceDbDocsRow[] = [
      {
        title: mockRowTitle,
        vector: initializationVector,
        starturl: "",
        content: "",
        path: "",
        startline: 0,
        endline: 0,
      },
    ];

    const table = await connection.createTable(tableName, mockRow);

    await runLanceMigrations(table);

    await table.delete(`title = '${mockRowTitle}'`);
  }

  /**
   * From Lance: Table names can only contain alphanumeric characters,
   * underscores, hyphens, and periods
   */
  private sanitizeLanceTableName(name: string) {
    return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  }

  private async getLanceTableNameFromEmbeddingsProvider(
    isPreIndexedDoc: boolean,
  ) {
    const embeddingsProvider =
      await this.getEmbeddingsProvider(isPreIndexedDoc);

    const tableName = this.sanitizeLanceTableName(
      `${DocsService.lanceTableName}${embeddingsProvider.embeddingId}`,
    );

    return tableName;
  }

  private async getOrCreateLanceTable({
    initializationVector,
    isPreIndexedDoc,
  }: {
    initializationVector: number[];
    isPreIndexedDoc?: boolean;
  }) {
    const conn = await lancedb.connect(getLanceDbPath());
    const tableNames = await conn.tableNames();
    const tableNameFromEmbeddingsProvider =
      await this.getLanceTableNameFromEmbeddingsProvider(!!isPreIndexedDoc);

    if (!tableNames.includes(tableNameFromEmbeddingsProvider)) {
      if (initializationVector) {
        await this.createLanceDocsTable(
          conn,
          initializationVector,
          tableNameFromEmbeddingsProvider,
        );
      } else {
        console.trace(
          "No existing Lance DB docs table was found and no initialization " +
            "vector was passed to create one",
        );
      }
    }

    const table = await conn.openTable(tableNameFromEmbeddingsProvider);

    this.lanceTableNamesSet.add(tableNameFromEmbeddingsProvider);

    return table;
  }

  // Methods for adding individual docs
  private async addToLance({
    chunks,
    siteIndexingConfig,
    embeddings,
  }: AddParams) {
    const sampleVector = embeddings[0];
    const isPreIndexedDoc = !!preIndexedDocs[siteIndexingConfig.startUrl];

    const table = await this.getOrCreateLanceTable({
      isPreIndexedDoc,
      initializationVector: sampleVector,
    });

    const rows: LanceDbDocsRow[] = chunks.map((chunk, i) => ({
      vector: embeddings[i],
      starturl: siteIndexingConfig.startUrl,
      title: chunk.otherMetadata?.title || siteIndexingConfig.title,
      content: chunk.content,
      path: chunk.filepath,
      startline: chunk.startLine,
      endline: chunk.endLine,
    }));

    await table.add(rows);
  }

  private async addMetadataToSqlite({
    siteIndexingConfig: { title, startUrl },
    favicon,
  }: AddParams) {
    const db = await this.getOrCreateSqliteDb();
    await db.run(
      `INSERT INTO ${DocsService.sqlitebTableName} (title, startUrl, favicon) VALUES (?, ?, ?)`,
      title,
      startUrl,
      favicon,
    );
  }

  private addToConfig(siteIndexingConfig: SiteIndexingConfig) {
    // Handles the case where a user has manually added the doc to config.json
    // so it already exists in the file
    const doesDocExist = this.config.docs?.some(
      (doc) => doc.startUrl === siteIndexingConfig.startUrl,
    );

    if (!doesDocExist) {
      editConfigJson((config) => ({
        ...config,
        docs: [...(config.docs ?? []), siteIndexingConfig],
      }));
    }
  }

  private async add(params: AddParams) {
    await this.addToLance(params);
    await this.addMetadataToSqlite(params);
  }

  // Delete methods
  private async deleteEmbeddingsFromLance(startUrl: string) {
    for (const tableName of this.lanceTableNamesSet) {
      const conn = await lancedb.connect(getLanceDbPath());
      const table = await conn.openTable(tableName);
      await table.delete(`starturl = '${startUrl}'`);
    }
  }

  private async deleteMetadataFromSqlite(startUrl: string) {
    const db = await this.getOrCreateSqliteDb();
    await db.run(
      `DELETE FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );
  }

  private deleteFromConfig(startUrl: string) {
    const doesDocExist = this.config.docs?.some(
      (doc) => doc.startUrl === startUrl,
    );
    if (doesDocExist) {
      editConfigJson((config) => ({
        ...config,
        docs: config.docs?.filter((doc) => doc.startUrl !== startUrl) || [],
      }));
    }
  }

  async deleteIndexes(startUrl: string) {
    await this.deleteEmbeddingsFromLance(startUrl);
    await this.deleteMetadataFromSqlite(startUrl);
  }

  async delete(startUrl: string) {
    this.docsIndexingQueue.delete(startUrl);
    this.abort(startUrl);
    await this.deleteIndexes(startUrl);
    this.deleteFromConfig(startUrl);
    this.messenger?.send("refreshSubmenuItems", undefined);
  }

  /**
   * Currently this deletes re-crawls + re-indexes all docs.
   * A more optimal solution in the future will be to create
   * a per-embeddings-provider table for docs.
   */
  private async reindexDocsOnNewEmbeddingsProvider() {
    // We use config as our source of truth here since it contains additional information
    // needed for re-crawling such as `faviconUrl` and `maxDepth`.
    const { docs, embeddingsProvider } = this.config;

    if (!docs || docs.length === 0) {
      return;
    }

    console.log(
      `Reindexing non-preindexed docs with new embeddings provider: ${embeddingsProvider.embeddingId}`,
    );
    await Promise.allSettled(docs.map((doc) => this.indexAndAdd(doc)));

    // Important that this only is invoked after we have successfully
    // cleared and reindex the docs so that the table cannot end up in an
    // invalid state.
    this.globalContext.update(
      "curEmbeddingsProviderId",
      embeddingsProvider.embeddingId,
    );

    console.log("Completed reindexing of all non-preindexed docs");
  }
}
