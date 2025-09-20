import { Chunk, ILLM, IndexingStatus, SiteIndexingConfig } from "../..";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { Telemetry } from "../../util/posthog";
import {
  ArticleWithChunks,
  htmlPageToArticleWithChunks,
  markdownPageToArticleWithChunks,
} from "./article";
import DocsCrawler, { DocsCrawlerType, PageData } from "./crawlers/DocsCrawler";
type StatusUpdateCallback = (
  status: IndexingStatus["status"],
  description: IndexingStatus["description"],
  progress: IndexingStatus["progress"],
) => void;

interface EmbeddingDocInfo {
  siteIndexingConfig: SiteIndexingConfig;
  statusUpdateCallback: StatusUpdateCallback;
  docsCrawler: DocsCrawler;
  shouldCancelCallback: () => boolean;
  embeddingProvider: ILLM | TransformersJsEmbeddingsProvider;
}

interface EmbeddingResult {
  embeddings: number[][];
  chunks: Chunk[];
}

const NUM_CONCURRENT_EMBEDDINGS = 3;

/**
 * Manages a queue of document embedding tasks, processing them concurrently up to a specified limit.
 * This class handles the entire lifecycle of an embedding task, from crawling and chunking
 * documents to generating the final embeddings.
 */
export class EmbeddingManager {
  /**
   * @private
   * The queue of pending embedding tasks. Each entry is a tuple containing the
   * document information and the resolve function for its corresponding promise.
   */
  private queue: [
    EmbeddingDocInfo,
    (
      value:
        | EmbeddingResult
        | PromiseLike<EmbeddingResult | undefined>
        | undefined,
    ) => void,
  ][] = [];

  /**
   * @private
   * A set of start URLs for the tasks that are currently being processed.
   * This is used to prevent duplicate processing of the same site.
   */
  private currentIndexing: Set<string> = new Set();

  /**
   * @private
   * The maximum number of embedding tasks that can be run in parallel.
   */
  private maxNumberOfConcurrentProcesses: number = NUM_CONCURRENT_EMBEDDINGS;

  constructor() {}

  /**
   * Adds a new document embedding task to the queue.
   * If a task for the same start URL is already being indexed, this request is ignored.
   * @param embeddingDocInfo - The configuration and callbacks for the embedding task.
   * @returns A promise that resolves with the `EmbeddingResult` upon successful completion,
   * or `undefined` if the task is cancelled or if a task for the same URL is already in progress.
   */
  public enqueue(
    embeddingDocInfo: EmbeddingDocInfo,
  ): Promise<EmbeddingResult | undefined> | undefined {
    if (
      this.currentIndexing.has(embeddingDocInfo.siteIndexingConfig.startUrl)
    ) {
      return;
    }

    const { statusUpdateCallback } = embeddingDocInfo;
    let resolvePromise;
    const p = new Promise<EmbeddingResult | undefined>((resolve) => {
      resolvePromise = resolve;
    });
    this.queue.push([embeddingDocInfo, resolvePromise!]);
    statusUpdateCallback("pending", "Enqueued to the embedding manager", 0);
    this.deployEmbedingProcess();
    return p;
  }

  /**
   * Attempts to start a new embedding process if there is an available slot and
   * tasks are waiting in the queue. This method is called after a new task is
   * enqueued or an existing one completes.
   */
  public deployEmbedingProcess() {
    if (
      this.queue.length > 0 &&
      this.currentIndexing.size < this.maxNumberOfConcurrentProcesses
    ) {
      const [embeddingDocInfo, resolvePromise] = this.queue.shift()!;
      this.currentIndexing.add(embeddingDocInfo.siteIndexingConfig.startUrl);
      void this.embed(embeddingDocInfo, resolvePromise);
    }
  }

  /**
   * @private
   * Performs cleanup tasks after an embedding process is finished (either completed or cancelled).
   * It removes the task from the set of currently indexing tasks and attempts to deploy a new one.
   * @param startUrl - The start URL of the task that has just finished.
   */
  private postEmbeddingChore(startUrl: string) {
    this.currentIndexing.delete(startUrl);
    this.deployEmbedingProcess();
  }

  /**
   * @private
   * The core async method that handles the embedding process for a single document source.
   * This includes crawling pages, chunking content, and generating embeddings.
   * It provides progress updates and handles cancellation requests.
   * @param embeddingDocInfo - The configuration for the embedding job.
   * @param resolvePromise - The function to call to resolve the promise associated with this task.
   */
  private async embed(
    embeddingDocInfo: EmbeddingDocInfo,
    resolvePromise: (
      value:
        | EmbeddingResult
        | PromiseLike<EmbeddingResult | undefined>
        | undefined,
    ) => void,
  ) {
    const {
      siteIndexingConfig,
      statusUpdateCallback,
      docsCrawler,
      shouldCancelCallback,
      embeddingProvider,
    } = embeddingDocInfo;

    const { startUrl } = siteIndexingConfig;

    // ######## Crawing pages ########
    statusUpdateCallback("indexing", "Finding subpages", 0);
    // Crawl pages to get page data
    const pages: PageData[] = [];
    let processedPages = 0;
    let estimatedProgress = 0;
    let done = false;
    let usedCrawler: DocsCrawlerType | undefined = undefined;

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
        if (shouldCancelCallback()) {
          this.postEmbeddingChore(startUrl);
          resolvePromise(undefined);
          return;
        }
        statusUpdateCallback(
          "indexing",
          `Finding subpages (${page.path})`,
          0.15 * estimatedProgress +
            Math.min(0.35, (0.35 * processedPages) / 500),
          // For the first 50%, 15% is sum of series 1/(2^n) and the other 35% is based on number of files/ 500 max
        );

        pages.push(page);

        processedPages++;

        // Locks down GUI if no sleeping
        const toWait = 150;
        await new Promise((resolve) => setTimeout(resolve, toWait));
      }
    }

    void Telemetry.capture("docs_pages_crawled", {
      count: processedPages,
    });

    // ######## Chunk pages ########
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
        embeddingProvider.maxEmbeddingChunkSize,
      );
      if (articleWithChunks) {
        articles.push(articleWithChunks);
      }
      const toWait = 30;
      await new Promise((resolve) => setTimeout(resolve, toWait));
    }

    // const chunks: Chunk[] = [];
    const embeddings: number[][] = [];

    // ######## Create embeddings ########
    // Create embeddings of retrieved articles
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      if (shouldCancelCallback()) {
        this.postEmbeddingChore(startUrl);
        resolvePromise(undefined);
        return;
      }
      statusUpdateCallback(
        "indexing",
        `Creating Embeddings: ${article.article.subpath}`,
        0.5 + 0.3 * (i / articles.length), // 50% -> 80%
      );

      try {
        const subpathEmbeddings =
          article.chunks.length > 0
            ? await embeddingProvider.embed(
                article.chunks.map((c) => c.content),
              )
            : [];
        chunks.push(...article.chunks);
        embeddings.push(...subpathEmbeddings);

        const toWait = 150;
        await new Promise((resolve) => setTimeout(resolve, toWait));
      } catch (e) {
        console.warn("Error embedding article chunks: ", e);
      }
    }

    this.postEmbeddingChore(startUrl);
    resolvePromise({ embeddings, chunks });
  }
}
