import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import lancedb, { Connection } from "vectordb";

import {
  Chunk,
  ContinueConfig,
  EmbeddingsProvider,
  IDE,
  IndexingStatusUpdate,
  SiteIndexingConfig,
} from "../..";
import { ConfigHandler } from "../../config/ConfigHandler";
import { addContextProvider } from "../../config/util";
import DocsContextProvider from "../../context/providers/DocsContextProvider";
import { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import { fetchFavicon, getFaviconBase64 } from "../../util/fetchFavicon";
import { GlobalContext } from "../../util/GlobalContext";
import { IMessenger } from "../../util/messenger";
import {
  editConfigJson,
  getDocsSqlitePath,
  getLanceDbPath,
} from "../../util/paths";
import { Telemetry } from "../../util/posthog";
import TransformersJsEmbeddingsProvider from "../embeddings/TransformersJsEmbeddingsProvider";
import { IndexingStatusManager } from "../IndexingStatusManager";

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
  static indexingType = "docs";

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

  constructor(
    configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly messenger?: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly indexingManager?: IndexingStatusManager,
  ) {
    this.isInitialized = this.init(configHandler);
  }

  // Singleton pattern: only one service globally
  private static instance?: DocsService;
  static createSingleton(
    configHandler: ConfigHandler,
    ide: IDE,
    messenger?: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    indexingManager?: IndexingStatusManager,
  ) {
    const docsService = new DocsService(
      configHandler,
      ide,
      messenger,
      indexingManager,
    );
    DocsService.instance = docsService;
    return docsService;
  }

  static getSingleton() {
    return DocsService.instance;
  }

  // Initialization - load config and attach config listener
  private async init(configHandler: ConfigHandler) {
    this.indexingManager?.registerService(
      DocsService.indexingType,
      this.reindexDoc,
    );
    const config = await configHandler.loadConfig();
    this.config = config;

    // On first go we want to have an indexing status for all docs
    // Since config handler will only trigger indexing status updates on changes
    if (config.docs?.length) {
      for (const doc of config.docs) {
        await this.indexAndAdd(doc);
      }
    }

    await this.handleConfigUpdate({ config });
    configHandler.onConfigUpdate(this.handleConfigUpdate.bind(this));
  }

  // Config

  /*
   * Currently, we generate and host embeddings for pre-indexed docs using transformers.
   * However, we don't ship transformers with the JetBrains extension.
   * So, we only include pre-indexed docs in the submenu for non-JetBrains IDEs.
   */
  async canUsePreindexedDocs() {
    const ideInfo = await this.ide.getIdeInfo();
    if (ideInfo.ideType === "jetbrains") {
      return false;
    }
    return true;
  }

  async isUsingUnsupportedPreIndexedEmbeddingsProvider() {
    const isPreIndexedDocsProvider =
      this.config.embeddingsProvider.id ===
      DocsService.preIndexedDocsEmbeddingsProvider.id;
    const canUsePreindexedDocs = await this.canUsePreindexedDocs();
    return isPreIndexedDocsProvider && !canUsePreindexedDocs;
  }

  async getEmbeddingsProvider(
    isPreIndexedDoc: boolean = false,
  ): Promise<EmbeddingsProvider> {
    const canUsePreindexedDocs = await this.canUsePreindexedDocs();

    if (canUsePreindexedDocs && isPreIndexedDoc) {
      return DocsService.preIndexedDocsEmbeddingsProvider;
    }

    return this.config.embeddingsProvider;
  }

  // Expose this so that docs provider can check it

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

      // On embeddings provider change, reindex all non-preindexed docs
      // change = doesn't match last successful embeddings provider
      const curEmbeddingsProviderId = this.globalContext.get(
        "curEmbeddingsProviderId",
      );
      if (
        !curEmbeddingsProviderId ||
        curEmbeddingsProviderId !== newConfig.embeddingsProvider.id
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
  }

  async hasMetadata(startUrl: string): Promise<Promise<boolean>> {
    const db = await this.getOrCreateSqliteDb();
    const title = await db.get(
      `SELECT title FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );

    return !!title;
  }

  // private async hasIndexedDoc(startUrl: string) {
  //   const db = await this.getOrCreateSqliteDb();
  //   const docs = await db.all(
  //     `SELECT startUrl FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
  //     startUrl,
  //   );

  //   return docs.length > 0;
  // }

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

  async indexAllDocsWithPrompt(reIndex: boolean = false) {
    if (!this.hasDocsContextProvider()) {
      const didAddDocsContextProvider =
        await this.showAddDocsContextProviderToast();

      if (!didAddDocsContextProvider) {
        return;
      }
    }

    const docs = await this.listMetadata();

    for (const doc of docs) {
      await this.indexAndAdd(doc, reIndex);
    }

    void this.ide.showToast("info", "Docs indexing completed");
  }

  async listMetadata() {
    const db = await this.getOrCreateSqliteDb();
    const docs = await db.all<SqliteDocsRow[]>(
      `SELECT title, startUrl, favicon FROM ${DocsService.sqlitebTableName}`,
    );

    return docs;
  }

  updateIndexingStatus(update: IndexingStatusUpdate) {
    this.indexingManager?.handleUpdate(update);
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

    if (this.docsIndexingQueue.has(startUrl)) {
      console.debug("Already in queue");
      return;
    }
    const embeddingsProvider = await this.getEmbeddingsProvider();

    const indexExists = await this.hasMetadata(startUrl);

    const fixedStatus: Pick<
      IndexingStatusUpdate,
      "type" | "id" | "embeddingsProviderId" | "isReindexing"
    > = {
      type: "docs",
      id: siteIndexingConfig.startUrl,
      embeddingsProviderId: embeddingsProvider.id,
      isReindexing: reIndex && indexExists,
    };

    if (indexExists && !reIndex) {
      this.updateIndexingStatus({
        ...fixedStatus,
        progress: 1,
        description: "Complete",
        status: "complete",
        debugInfo: "Already indexed",
      });
      return;
    }

    // Mark the site as currently being indexed
    this.docsIndexingQueue.add(startUrl);
    try {
      this.updateIndexingStatus({
        ...fixedStatus,
        status: "indexing",
        description: "Finding subpages",
        progress: 0,
      });

      const articles: Article[] = [];
      let processedPages = 0;
      let maxKnownPages = 1;

      // Crawl pages and retrieve info as articles
      for await (const page of this.docsCrawler.crawl(new URL(startUrl))) {
        processedPages++;

        const article = pageToArticle(page);

        if (!article) {
          continue;
        }

        articles.push(article);

        // Use a heuristic approach for progress calculation
        const progress = Math.min(processedPages / maxKnownPages, 1);

        this.updateIndexingStatus({
          ...fixedStatus,
          description: `Finding subpages (${page.path})`,
          status: "indexing",
          progress, // Yield the heuristic progress
        });

        // Increase maxKnownPages to delay progress reaching 100% too soon
        if (processedPages === maxKnownPages) {
          maxKnownPages *= 2;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      void Telemetry.capture("docs_pages_crawled", {
        count: processedPages,
      });

      const chunks: Chunk[] = [];
      const embeddings: number[][] = [];

      // Create embeddings of retrieved articles
      console.debug(`Creating embeddings for ${articles.length} articles`);

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        this.updateIndexingStatus({
          ...fixedStatus,
          status: "indexing",
          description: `Creating Embeddings: ${article.subpath}`,
          progress: i / articles.length,
        });

        try {
          const chunkedArticle = chunkArticle(
            article,
            embeddingsProvider.maxChunkSize,
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

        this.updateIndexingStatus({
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

      this.updateIndexingStatus({
        ...fixedStatus,
        description: `Adding ${embeddings.length} embeddings to db`,
        status: "indexing",
        progress: 0.5,
      });

      // Delete indexed docs if re-indexing
      if (reIndex && (await this.hasMetadata(startUrl.toString()))) {
        console.log("Deleting old embeddings");
        await this.delete(startUrl);
      }

      const favicon = await fetchFavicon(new URL(siteIndexingConfig.startUrl));

      await this.add({
        siteIndexingConfig,
        chunks,
        embeddings,
        favicon,
      });

      this.docsIndexingQueue.delete(startUrl);

      this.updateIndexingStatus({
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
      this.updateIndexingStatus({
        ...fixedStatus,
        description: `No embeddings were created for site: ${siteIndexingConfig.startUrl}`,
        status: "failed",
        progress: 1,
      });
    } finally {
      this.docsIndexingQueue.delete(startUrl);
    }
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
        `${DocsService.preIndexedDocsEmbeddingsProvider.id} is configured as ` +
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

      // const newDocs = newConfigDocs.filter(
      //   (doc) => !currentStartUrls.includes(doc.startUrl),
      // );

      // Anything found in sqlite but not in new config should be deleted
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
        const oldConfigDoc = oldConfigDocs.find(
          (d) => d.startUrl === doc.startUrl,
        );
        const currentIndexedDoc = currentStartUrls.includes(doc.startUrl);

        if (currentIndexedDoc) {
          if (
            oldConfigDoc &&
            (oldConfigDoc.maxDepth !== doc.maxDepth ||
              oldConfigDoc.title !== doc.title ||
              oldConfigDoc.faviconUrl !== doc.faviconUrl)
          ) {
            changedDocs.push(doc);
          }
          // if get's here, not changed, no update needed
        } else {
          newDocs.push(doc);
        }
      }

      for (const doc of changedDocs) {
        console.log(`Updating indexed doc: ${doc.startUrl}`);
        await this.indexAndAdd(doc, true);
      }

      for (const doc of newDocs) {
        console.log(`Indexing new doc: ${doc.startUrl}`);
        void Telemetry.capture("add_docs_config", { url: doc.startUrl });

        await this.indexAndAdd(doc);
      }

      for (const doc of deletedDocs) {
        await this.delete(doc.startUrl);
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
      `${DocsService.lanceTableName}${embeddingsProvider.id}`,
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

  private addToConfig({ siteIndexingConfig }: AddParams) {
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

    const isPreIndexedDoc =
      !!preIndexedDocs[params.siteIndexingConfig.startUrl];

    if (!isPreIndexedDoc) {
      this.addToConfig(params);
    }
  }

  // Delete methods for individual docs
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
    editConfigJson((config) => ({
      ...config,
      docs: config.docs?.filter((doc) => doc.startUrl !== startUrl) || [],
    }));
  }

  async delete(startUrl: string) {
    await this.deleteEmbeddingsFromLance(startUrl);
    await this.deleteMetadataFromSqlite(startUrl);
    this.deleteFromConfig(startUrl);

    if (this.messenger) {
      this.messenger.send("refreshSubmenuItems", undefined);
    }
  }

  // When user requests a pre-indexed doc for the first time
  // And pre-indexed embeddings are supported
  // Fetch pre-indexed embeddings from S3, add to Lance, and then search those
  private async fetchAndAddPreIndexedDocEmbeddings(title: string) {
    const embeddingsProvider = await this.getEmbeddingsProvider(true);

    const data = await downloadFromS3(
      S3Buckets.continueIndexedDocs,
      getS3Filename(embeddingsProvider.id, title),
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
      `Reindexing non-preindexed docs with new embeddings provider: ${embeddingsProvider.id}`,
    );

    for (const doc of docs) {
      await this.delete(doc.startUrl);
    }

    for (const doc of docs) {
      await this.indexAndAdd(doc);
    }

    // Important that this only is invoked after we have successfully
    // cleared and reindex the docs so that the table cannot end up in an
    // invalid state.
    this.globalContext.update("curEmbeddingsProviderId", embeddingsProvider.id);

    console.log("Completed reindexing of all non-preindexed docs");
  }
}
