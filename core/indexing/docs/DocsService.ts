import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import lancedb, { Connection } from "vectordb";

import {
  Chunk,
  ContinueConfig,
  DocsIndexingDetails,
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
import { IMessenger } from "../../protocol/messenger";
import { fetchFavicon, getFaviconBase64 } from "../../util/fetchFavicon";
import {
  editConfigJson,
  getDocsSqlitePath,
  getLanceDbPath,
} from "../../util/paths";
import { Telemetry } from "../../util/posthog";

import { ConfigResult } from "@continuedev/config-yaml";
import { GlobalContext } from "../../util/GlobalContext";
import {
  ArticleWithChunks,
  htmlPageToArticleWithChunks,
  markdownPageToArticleWithChunks,
} from "./article";
import DocsCrawler, { DocsCrawlerType, PageData } from "./crawlers/DocsCrawler";
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
*/
export default class DocsService {
  static lanceTableName = "docs";
  static sqlitebTableName = "docs";

  static preIndexedDocsEmbeddingsProvider =
    new TransformersJsEmbeddingsProvider();

  public isInitialized: Promise<void>;
  public isSyncing: boolean = false;

  private docsIndexingQueue = new Set<string>();
  private lanceTableNamesSet = new Set<string>();

  private config!: ContinueConfig;
  private sqliteDb?: Database;

  private ideInfoPromise: Promise<IdeInfo>;
  private githubToken?: string;

  constructor(
    configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly messenger?: IMessenger<ToCoreProtocol, FromCoreProtocol>,
  ) {
    this.ideInfoPromise = this.ide.getIdeInfo();
    this.isInitialized = this.init(configHandler);
  }

  setGithubToken(token: string) {
    this.githubToken = token;
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
    const result = await configHandler.loadConfig();
    await this.handleConfigUpdate(result);
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
        console.error("Invalid config docs entry, no start url", doc.title);
        return;
      }

      const currentStatus = this.statuses.get(doc.startUrl);
      if (currentStatus) {
        this.handleStatusUpdate(currentStatus);
        return;
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
    if (this.docsIndexingQueue.has(startUrl)) {
      const status = this.statuses.get(startUrl);
      if (status) {
        this.handleStatusUpdate({
          ...status,
          status: "aborted",
          progress: 0,
          description: "Canceled",
        });
      }
      this.docsIndexingQueue.delete(startUrl);
    }
  }

  // Used to check periodically during indexing if should cancel indexing
  shouldCancel(startUrl: string, startedWithEmbedder: string) {
    // Check if aborted
    const isAborted = this.statuses.get(startUrl)?.status === "aborted";
    if (isAborted) {
      return true;
    }

    // Handle embeddings provider change mid-indexing
    if (this.config.embeddingsProvider.embeddingId !== startedWithEmbedder) {
      this.abort(startUrl);
      return true;
    }
    return false;
  }

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

  // Determines if using preIndexed and returns proper embeddings provider
  async getEmbeddingsProvider(startUrl: string) {
    // Conditions for using a pre-indexed doc

    // Must be in pre indexed docs file
    const preIndexedDoc = preIndexedDocs[startUrl];
    if (preIndexedDoc) {
      // Most not be overriden by config
      if (!this.config?.docs?.find((doc) => doc.startUrl === startUrl)) {
        // Must be supported
        const canUsePreindexedDocs = await this.canUsePreindexedDocs();
        if (canUsePreindexedDocs) {
          return {
            provider: DocsService.preIndexedDocsEmbeddingsProvider,
            isPreindexed: true,
          };
        }
      }
    }
    return {
      provider: this.config.embeddingsProvider,
      isPreindexed: false,
    };
  }

  private async handleConfigUpdate({
    config: newConfig,
  }: ConfigResult<ContinueConfig>) {
    if (newConfig) {
      const oldConfig = this.config;
      this.config = newConfig; // IMPORTANT - need to set up top, other methods below use this without passing it in

      // No point in indexing if no docs context provider
      const hasDocsContextProvider = this.hasDocsContextProvider();
      if (!hasDocsContextProvider) {
        return;
      }

      // Skip docs indexing if not supported
      // No warning message here because would show on ANY config update
      const unsupported =
        await this.isUsingUnsupportedPreIndexedEmbeddingsProvider();
      if (unsupported) {
        return;
      }

      await this.syncDocs(oldConfig, newConfig, false);
    }
  }

  async syncDocsWithPrompt(reIndex: boolean = false) {
    if (!this.hasDocsContextProvider()) {
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
      } else {
        return;
      }
    }

    await this.syncDocs(undefined, this.config, reIndex);

    void this.ide.showToast("info", "Docs indexing completed");
  }

  // Returns true if startUrl has been indexed with current embeddingsProvider
  async hasMetadata(startUrl: string): Promise<boolean> {
    const db = await this.getOrCreateSqliteDb();
    const title = await db.get(
      `SELECT title FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`,
      startUrl,
      this.config.embeddingsProvider.embeddingId,
    );

    return !!title;
  }

  async listMetadata() {
    const embeddingsProvider = this.config.embeddingsProvider;
    if (!embeddingsProvider) {
      return [];
    }
    const db = await this.getOrCreateSqliteDb();
    const docs = await db.all<SqliteDocsRow[]>(
      `SELECT title, startUrl, favicon FROM ${DocsService.sqlitebTableName}
      WHERE embeddingsProviderId = ?`,
      embeddingsProvider.embeddingId,
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
    forceReindex: boolean = false,
  ): Promise<void> {
    const { startUrl, useLocalCrawling, maxDepth } = siteIndexingConfig;

    // First, if indexing is already in process, don't attempt
    // This queue is necessary because indexAndAdd is invoked circularly by config edits
    // TODO shouldn't really be a gap between adding and checking in queue but probably fine
    if (this.docsIndexingQueue.has(startUrl)) {
      return;
    }

    const { isPreindexed, provider } =
      await this.getEmbeddingsProvider(startUrl);
    if (isPreindexed) {
      console.warn("Attempted to indexAndAdd pre-indexed doc");
      return;
    }
    const startedWithEmbedder = provider.embeddingId;

    // Check if doc has been successfully indexed with the given embedder
    // Note at this point we know it's not a pre-indexed doc
    const indexExists = await this.hasMetadata(startUrl);

    // Build status update - most of it is fixed values
    const fixedStatus: Omit<
      IndexingStatus,
      "progress" | "description" | "status"
    > = {
      type: "docs",
      id: siteIndexingConfig.startUrl,
      embeddingsProviderId: provider.embeddingId,
      isReindexing: forceReindex && indexExists,
      title: siteIndexingConfig.title,
      debugInfo: `max depth: ${siteIndexingConfig.maxDepth}`,
      icon: siteIndexingConfig.faviconUrl,
      url: siteIndexingConfig.startUrl,
    };

    // If not force-reindexing and has failed with same config, don't reattempt
    if (!forceReindex) {
      const globalContext = new GlobalContext();
      const failedDocs = globalContext.get("failedDocs") ?? [];
      const hasFailed = failedDocs.find((d) =>
        this.siteIndexingConfigsAreEqual(siteIndexingConfig, d),
      );
      if (hasFailed) {
        console.log(
          `Not reattempting to index ${siteIndexingConfig.startUrl}, has already failed with same config`,
        );
        this.handleStatusUpdate({
          ...fixedStatus,
          description: "Failed",
          status: "failed",
          progress: 1,
        });
        return;
      }
    }

    if (indexExists && !forceReindex) {
      this.handleStatusUpdate({
        ...fixedStatus,
        progress: 1,
        description: "Complete",
        status: "complete",
        debugInfo: "Already indexed",
      });
      return;
    }

    // Do a test run on the embedder
    // This particular failure will not mark as a failed config in global context
    // Since SiteIndexingConfig is likely to be valid
    try {
      await provider.embed(["continue-test-run"]);
    } catch (e) {
      console.error("Failed to test embeddings connection", e);
      return;
    }

    const markFailedInGlobalContext = () => {
      const globalContext = new GlobalContext();
      const failedDocs = globalContext.get("failedDocs") ?? [];
      const newFailedDocs = failedDocs.filter(
        (d) => !this.siteIndexingConfigsAreEqual(siteIndexingConfig, d),
      );
      newFailedDocs.push(siteIndexingConfig);
      globalContext.update("failedDocs", newFailedDocs);
    };

    const removeFromFailedGlobalContext = () => {
      const globalContext = new GlobalContext();
      const failedDocs = globalContext.get("failedDocs") ?? [];
      const newFailedDocs = failedDocs.filter(
        (d) => !this.siteIndexingConfigsAreEqual(siteIndexingConfig, d),
      );
      globalContext.update("failedDocs", newFailedDocs);
    };

    try {
      this.docsIndexingQueue.add(startUrl);

      // Clear current indexes if reIndexing
      if (indexExists && forceReindex) {
        await this.deleteIndexes(startUrl);
      }

      this.addToConfig(siteIndexingConfig);

      this.handleStatusUpdate({
        ...fixedStatus,
        status: "indexing",
        description: "Finding subpages",
        progress: 0,
      });

      // Crawl pages to get page data
      const pages: PageData[] = [];
      let processedPages = 0;
      let estimatedProgress = 0;
      let done = false;
      let usedCrawler: DocsCrawlerType | undefined = undefined;

      const docsCrawler = new DocsCrawler(
        this.ide,
        this.config,
        maxDepth,
        undefined,
        useLocalCrawling,
        this.githubToken,
      );
      const crawlerGen = docsCrawler.crawl(new URL(startUrl));

      while (!done) {
        const result = await crawlerGen.next();
        if (result.done) {
          done = true;
          usedCrawler = result.value;
        } else {
          const page = result.value;
          estimatedProgress += 1 / 2 ** (processedPages + 1);

          // NOTE - during "indexing" phase, check if aborted before each status update
          if (this.shouldCancel(startUrl, startedWithEmbedder)) {
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

          pages.push(page);

          processedPages++;

          // Locks down GUI if no sleeping
          // Wait proportional to how many docs are indexing
          const toWait = 100 * this.docsIndexingQueue.size + 50;
          await new Promise((resolve) => setTimeout(resolve, toWait));
        }
      }

      void Telemetry.capture("docs_pages_crawled", {
        count: processedPages,
      });

      // Chunk pages based on which crawler was used
      const articles: ArticleWithChunks[] = [];
      const chunks: Chunk[] = [];
      const articleChunker =
        usedCrawler === "github"
          ? markdownPageToArticleWithChunks
          : htmlPageToArticleWithChunks;
      for (const page of pages) {
        const articleWithChunks = await articleChunker(
          page,
          provider.maxEmbeddingChunkSize,
        );
        if (articleWithChunks) {
          articles.push(articleWithChunks);
        }
        const toWait = 20 * this.docsIndexingQueue.size + 10;
        await new Promise((resolve) => setTimeout(resolve, toWait));
      }

      // const chunks: Chunk[] = [];
      const embeddings: number[][] = [];

      // Create embeddings of retrieved articles
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];

        if (this.shouldCancel(startUrl, startedWithEmbedder)) {
          return;
        }
        this.handleStatusUpdate({
          ...fixedStatus,
          status: "indexing",
          description: `Creating Embeddings: ${article.article.subpath}`,
          progress: 0.5 + 0.3 * (i / articles.length), // 50% -> 80%
        });

        try {
          const subpathEmbeddings =
            article.chunks.length > 0
              ? await provider.embed(article.chunks.map((c) => c.content))
              : [];
          chunks.push(...article.chunks);
          embeddings.push(...subpathEmbeddings);
          const toWait = 100 * this.docsIndexingQueue.size + 50;
          await new Promise((resolve) => setTimeout(resolve, toWait));
        } catch (e) {
          console.warn("Error embedding article chunks: ", e);
        }
      }

      if (embeddings.length === 0) {
        console.error(
          `No embeddings were created for site: ${startUrl}\n Num chunks: ${chunks.length}`,
        );

        if (this.shouldCancel(startUrl, startedWithEmbedder)) {
          return;
        }
        this.handleStatusUpdate({
          ...fixedStatus,
          description: `No embeddings were created for site: ${startUrl}`,
          status: "failed",
          progress: 1,
        });

        void this.ide.showToast("info", `Failed to index ${startUrl}`);
        markFailedInGlobalContext();
        return;
      }

      // Add docs to databases
      console.log(`Adding ${embeddings.length} embeddings to db`);

      if (this.shouldCancel(startUrl, startedWithEmbedder)) {
        return;
      }
      this.handleStatusUpdate({
        ...fixedStatus,
        description: "Deleting old embeddings from the db",
        status: "indexing",
        progress: 0.8,
      });

      // Delete indexed docs if re-indexing
      if (forceReindex && indexExists) {
        console.log("Deleting old embeddings");
        await this.deleteIndexes(startUrl);
      }

      const favicon = await fetchFavicon(new URL(siteIndexingConfig.startUrl));

      if (this.shouldCancel(startUrl, startedWithEmbedder)) {
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

      this.handleStatusUpdate({
        ...fixedStatus,
        description: "Complete",
        status: "complete",
        progress: 1,
      });

      void this.ide.showToast("info", `Successfully indexed ${startUrl}`);

      this.messenger?.send("refreshSubmenuItems", {
        providers: ["docs"],
      });

      removeFromFailedGlobalContext();
    } catch (e) {
      console.error(
        `Error indexing docs at: ${siteIndexingConfig.startUrl}`,
        e,
      );
      let description = `Error indexing docs at: ${siteIndexingConfig.startUrl}`;
      if (e instanceof Error) {
        if (
          e.message.includes("github.com") &&
          e.message.includes("rate limit")
        ) {
          description = "Github rate limit exceeded"; // This text is used verbatim elsewhere
        }
      }
      this.handleStatusUpdate({
        ...fixedStatus,
        description,
        status: "failed",
        progress: 1,
      });
      markFailedInGlobalContext();
    } finally {
      this.docsIndexingQueue.delete(startUrl);
    }
  }

  // When user requests a pre-indexed doc for the first time
  // And pre-indexed embeddings are supported
  // Fetch pre-indexed embeddings from S3, add to Lance, and then search those
  private async fetchAndAddPreIndexedDocEmbeddings(title: string) {
    const data = await downloadFromS3(
      S3Buckets.continueIndexedDocs,
      getS3Filename(
        DocsService.preIndexedDocsEmbeddingsProvider.embeddingId,
        title,
      ),
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

    const { isPreindexed, provider } =
      await this.getEmbeddingsProvider(startUrl);

    if (isPreindexed) {
      void Telemetry.capture("docs_pre_indexed_doc_used", {
        doc: preIndexedDocs[startUrl]!["title"],
      });
    }

    const [vector] = await provider.embed([query]);

    return await this.retrieveChunks(startUrl, vector, nRetrieve, isPreindexed);
  }

  private lanceDBRowToChunk(row: LanceDbDocsRow): Chunk {
    return {
      digest: row.path,
      filepath: row.path,
      startLine: row.startline,
      endLine: row.endline,
      index: 0,
      content: row.content,
      otherMetadata: {
        title: row.title,
      },
    };
  }
  async getDetails(startUrl: string): Promise<DocsIndexingDetails> {
    const db = await this.getOrCreateSqliteDb();

    try {
      const { isPreindexed, provider } =
        await this.getEmbeddingsProvider(startUrl);
      const preIndexedDoc = preIndexedDocs[startUrl];
      const isPreIndexedDoc = !!preIndexedDoc;

      const result = await db.get(
        `SELECT startUrl, title, favicon FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`,
        startUrl,
        provider.embeddingId,
      );

      if (!result) {
        throw new Error(`${startUrl} not found in sqlite`);
      }
      const siteIndexingConfig: SiteIndexingConfig = {
        startUrl,
        faviconUrl: result.favicon,
        title: result.title,
      };

      const table = await this.getOrCreateLanceTable({
        initializationVector: [],
        startUrl,
      });
      const rows = (await table
        .filter(`starturl = '${startUrl}'`)
        .limit(1000)
        .execute()) as LanceDbDocsRow[];

      return {
        startUrl,
        config: siteIndexingConfig,
        indexingStatus: this.statuses.get(startUrl),
        chunks: rows.map(this.lanceDBRowToChunk),
        isPreIndexedDoc,
      };
    } catch (e) {
      console.warn("Error getting details", e);
      throw e;
    }
  }
  // This is split into its own function so that it can be recursive
  // in the case of fetching preindexed docs from s3
  async retrieveChunks(
    startUrl: string,
    vector: number[],
    nRetrieve: number,
    isPreindexed: boolean,
    isRetry: boolean = false,
  ): Promise<Chunk[]> {
    // Lance doesn't have an embeddingsprovider column, instead it includes it in the table name
    const table = await this.getOrCreateLanceTable({
      initializationVector: vector,
      startUrl,
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

    // No docs are found for preindexed? try fetching once
    if (docs.length === 0 && isPreindexed) {
      if (isRetry) {
        return [];
      }
      await this.fetchAndAddPreIndexedDocEmbeddings(
        preIndexedDocs[startUrl]!["title"],
      );
      return await this.retrieveChunks(startUrl, vector, nRetrieve, true, true);
    }

    return docs.map(this.lanceDBRowToChunk);
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
      // First create the table if it doesn't exist
      await db.exec(`CREATE TABLE IF NOT EXISTS ${DocsService.sqlitebTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title STRING NOT NULL,
            startUrl STRING NOT NULL,
            favicon STRING,
            embeddingsProviderId STRING
        )`);

      this.sqliteDb = db;
    }

    return this.sqliteDb;
  }

  async getFavicon(startUrl: string) {
    if (!this.config.embeddingsProvider) {
      console.warn(
        "Attempting to get favicon without embeddings provider specified",
      );
      return;
    }
    const db = await this.getOrCreateSqliteDb();
    const result = await db.get(
      `SELECT favicon FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`,
      startUrl,
      this.config.embeddingsProvider.embeddingId,
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
  private async syncDocs(
    oldConfig: ContinueConfig | undefined,
    newConfig: ContinueConfig,
    forceReindex: boolean,
  ) {
    try {
      this.isSyncing = true;

      // Otherwise sync the index based on config changes
      const oldConfigDocs = oldConfig?.docs || [];
      const newConfigDocs = newConfig.docs || [];
      const newConfigStartUrls = newConfigDocs.map((doc) => doc.startUrl);

      // NOTE since listMetadata filters by embeddings provider id embedding model changes are accounted for here
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
      const addedDocs: SiteIndexingConfig[] = [];
      const changedDocs: SiteIndexingConfig[] = [];
      for (const doc of newConfigDocs) {
        const currentIndexedDoc = currentStartUrls.includes(doc.startUrl);

        if (currentIndexedDoc) {
          const oldConfigDoc = oldConfigDocs.find(
            (d) => d.startUrl === doc.startUrl,
          );

          if (
            oldConfigDoc &&
            !this.siteIndexingConfigsAreEqual(oldConfigDoc, doc)
          ) {
            changedDocs.push(doc);
          } else {
            if (forceReindex) {
              changedDocs.push(doc);
            } else {
              // if get's here, not changed, no update needed, mark as complete
              this.handleStatusUpdate({
                type: "docs",
                id: doc.startUrl,
                embeddingsProviderId:
                  this.config.embeddingsProvider.embeddingId,
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
          }
        } else {
          addedDocs.push(doc);
          void Telemetry.capture("add_docs_config", { url: doc.startUrl });
        }
      }

      await Promise.allSettled([
        ...changedDocs.map((doc) => this.indexAndAdd(doc, true)),
        ...addedDocs.map((doc) => this.indexAndAdd(doc)),
      ]);

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

  private async getLanceTableName(embeddingsProvider: ILLM) {
    const tableName = this.sanitizeLanceTableName(
      `${DocsService.lanceTableName}${embeddingsProvider.embeddingId}`,
    );

    return tableName;
  }

  private async getOrCreateLanceTable({
    initializationVector,
    startUrl,
  }: {
    initializationVector: number[];
    startUrl: string;
  }) {
    const conn = await lancedb.connect(getLanceDbPath());
    const tableNames = await conn.tableNames();
    const { provider } = await this.getEmbeddingsProvider(startUrl);
    const tableNameFromEmbeddingsProvider =
      await this.getLanceTableName(provider);

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
    const { startUrl } = siteIndexingConfig;

    const table = await this.getOrCreateLanceTable({
      startUrl,
      initializationVector: sampleVector,
    });

    const rows: LanceDbDocsRow[] = chunks.map((chunk, i) => ({
      vector: embeddings[i],
      starturl: startUrl,
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
      `INSERT INTO ${DocsService.sqlitebTableName} (title, startUrl, favicon, embeddingsProviderId) VALUES (?, ?, ?, ?)`,
      title,
      startUrl,
      favicon,
      this.config.embeddingsProvider.embeddingId,
    );
  }

  private siteIndexingConfigsAreEqual(
    config1: SiteIndexingConfig,
    config2: SiteIndexingConfig,
  ) {
    return (
      config1.startUrl === config2.startUrl &&
      config1.faviconUrl === config2.faviconUrl &&
      config1.title === config2.title &&
      config1.maxDepth === config2.maxDepth &&
      config1.useLocalCrawling === config2.useLocalCrawling
    );
  }

  private addToConfig(siteIndexingConfig: SiteIndexingConfig) {
    // Handles the case where a user has manually added the doc to config.json
    // so it already exists in the file
    const doesEquivalentDocExist = this.config.docs?.some((doc) =>
      this.siteIndexingConfigsAreEqual(doc, siteIndexingConfig),
    );

    if (!doesEquivalentDocExist) {
      editConfigJson((config) => ({
        ...config,
        docs: [
          ...(config.docs?.filter(
            (doc) => doc.startUrl !== siteIndexingConfig.startUrl,
          ) ?? []),
          siteIndexingConfig,
        ],
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
    if (!this.config.embeddingsProvider) {
      console.warn(
        `Attempting to delete metadata for ${startUrl} without embeddings provider specified`,
      );
      return;
    }
    const db = await this.getOrCreateSqliteDb();

    await db.run(
      `DELETE FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`,
      startUrl,
      this.config.embeddingsProvider.embeddingId,
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

  private async deleteIndexes(startUrl: string) {
    await this.deleteEmbeddingsFromLance(startUrl);
    await this.deleteMetadataFromSqlite(startUrl);
  }

  async delete(startUrl: string) {
    this.docsIndexingQueue.delete(startUrl);
    this.abort(startUrl);
    await this.deleteIndexes(startUrl);
    this.deleteFromConfig(startUrl);
    this.messenger?.send("refreshSubmenuItems", {
      providers: ["docs"],
    });
  }
}
