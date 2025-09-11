import * as fs from "fs/promises";

import { ConfigHandler } from "../config/ConfigHandler.js";
import {
  ContextIndexingType,
  ContinueConfig,
  IDE,
  IndexingProgressUpdate,
  IndexTag,
} from "../index.js";
import type { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import type { IMessenger } from "../protocol/messenger";
import { extractMinimalStackTraceInfo } from "../util/extractMinimalStackTraceInfo.js";
import { Logger } from "../util/Logger.js";
import { getIndexSqlitePath, getLanceDbPath } from "../util/paths.js";
import { findUriInDirs, getUriPathBasename } from "../util/uri.js";

import { ConfigResult } from "@continuedev/config-yaml";
import { ContinueServerClient } from "../continueServer/stubs/client";
import { LLMError } from "../llm/index.js";
import { getRootCause } from "../util/errors.js";
import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex.js";
import { CodeSnippetsCodebaseIndex } from "./CodeSnippetsIndex.js";
import { embedModelsAreEqual } from "./docs/DocsService.js";
import { FullTextSearchCodebaseIndex } from "./FullTextSearchCodebaseIndex.js";
import { LanceDbIndex } from "./LanceDbIndex.js";
import { getComputeDeleteAddRemove, IndexLock } from "./refreshIndex.js";
import {
  CodebaseIndex,
  IndexResultType,
  PathAndCacheKey,
  RefreshIndexResults,
} from "./types.js";
import { walkDirAsync } from "./walkDir.js";

export class PauseToken {
  constructor(private _paused: boolean) {}

  set paused(value: boolean) {
    this._paused = value;
  }

  get paused(): boolean {
    return this._paused;
  }
}

export class CodebaseIndexer {
  /**
   * We batch for two reasons:
   * - To limit memory usage for indexes that perform computations locally, e.g. FTS
   * - To make as few requests as possible to the embeddings providers
   */
  filesPerBatch = 200;
  // We normally allow this to run in the background,
  // and only need to `await` it for tests.
  public initPromise: Promise<void>;
  private config!: ContinueConfig;
  private indexingCancellationController: AbortController;
  private codebaseIndexingState: IndexingProgressUpdate;
  private readonly pauseToken: PauseToken;
  private builtIndexes: CodebaseIndex[] = [];

  private getUserFriendlyIndexName(artifactId: string): string {
    if (artifactId === FullTextSearchCodebaseIndex.artifactId)
      return "Full text search";
    if (artifactId === CodeSnippetsCodebaseIndex.artifactId)
      return "Code snippets";
    if (artifactId === ChunkCodebaseIndex.artifactId) return "Chunking";
    if (artifactId.startsWith("vectordb")) return "Embedding";
    return artifactId; // fallback to original
  }

  // Note that we exclude certain Sqlite errors that we do not want to clear the indexes on,
  // e.g. a `SQLITE_BUSY` error.
  errorsRegexesToClearIndexesOn = [
    /Invalid argument error: Values length (d+) is less than the length ((d+)) multiplied by the value size (d+)/,
    /SQLITE_CONSTRAINT/,
    /SQLITE_ERROR/,
    /SQLITE_CORRUPT/,
    /SQLITE_IOERR/,
    /SQLITE_FULL/,
  ];

  constructor(
    private readonly configHandler: ConfigHandler,
    protected readonly ide: IDE,
    private readonly messenger?: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    initialPaused: boolean = false,
  ) {
    this.codebaseIndexingState = {
      status: "loading",
      desc: "loading",
      progress: 0,
    };

    // Initialize pause token
    this.pauseToken = new PauseToken(initialPaused);

    this.initPromise = this.init(configHandler);

    this.indexingCancellationController = new AbortController();
    this.indexingCancellationController.abort(); // initialize and abort so that a new one can be created
  }

  // Initialization - load config and attach config listener
  private async init(configHandler: ConfigHandler) {
    const result = await configHandler.loadConfig();
    await this.handleConfigUpdate(result);
    configHandler.onConfigUpdate(
      this.handleConfigUpdate.bind(this) as (arg: any) => void,
    );
  }

  set paused(value: boolean) {
    this.pauseToken.paused = value;
  }

  get paused(): boolean {
    return this.pauseToken.paused;
  }

  async clearIndexes() {
    const sqliteFilepath = getIndexSqlitePath();
    const lanceDbFolder = getLanceDbPath();

    try {
      await fs.unlink(sqliteFilepath);
    } catch (error) {
      // Capture indexer system failures to Sentry
      Logger.error(error, {
        filepath: sqliteFilepath,
      });
      console.error(`Error deleting ${sqliteFilepath} folder: ${error}`);
    }

    try {
      await fs.rm(lanceDbFolder, { recursive: true, force: true });
    } catch (error) {
      // Capture indexer system failures to Sentry
      Logger.error(error, {
        folderPath: lanceDbFolder,
      });
      console.error(`Error deleting ${lanceDbFolder}: ${error}`);
    }
  }

  protected async getIndexesToBuild(): Promise<CodebaseIndex[]> {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return [];
    }

    const embeddingsModel = config.selectedModelByRole.embed;
    if (!embeddingsModel) {
      return [];
    }

    const ideSettings = await this.ide.getIdeSettings();
    if (!ideSettings) {
      return [];
    }
    const continueServerClient = new ContinueServerClient(
      ideSettings.remoteConfigServerUrl,
      ideSettings.userToken,
    );
    if (!continueServerClient) {
      return [];
    }

    const indexTypesToBuild = new Set( // use set to remove duplicates
      config.contextProviders
        .map((provider) => provider.description.dependsOnIndexing)
        .filter((indexType) => Array.isArray(indexType)) // remove undefined indexTypes
        .flat(),
    );

    const indexTypeToIndexerMapping: Record<
      ContextIndexingType,
      () => Promise<CodebaseIndex | null>
    > = {
      chunk: async () =>
        new ChunkCodebaseIndex(
          this.ide.readFile.bind(this.ide),
          continueServerClient,
          embeddingsModel.maxEmbeddingChunkSize,
        ),
      codeSnippets: async () => new CodeSnippetsCodebaseIndex(this.ide),
      fullTextSearch: async () => new FullTextSearchCodebaseIndex(),
      embeddings: async () => {
        const lanceDbIndex = await LanceDbIndex.create(
          embeddingsModel,
          this.ide.readFile.bind(this.ide),
        );
        return lanceDbIndex;
      },
    };

    const indexes: CodebaseIndex[] = [];
    // not parallelizing to avoid race conditions in sqlite
    for (const indexType of indexTypesToBuild) {
      if (indexType && indexType in indexTypeToIndexerMapping) {
        const index = await indexTypeToIndexerMapping[indexType]();
        if (index) {
          indexes.push(index);
        }
      }
    }

    this.builtIndexes = indexes;
    return indexes;
  }

  private totalIndexOps(results: RefreshIndexResults): number {
    return (
      results.compute.length +
      results.del.length +
      results.addTag.length +
      results.removeTag.length
    );
  }

  private singleFileIndexOps(
    results: RefreshIndexResults,
    lastUpdated: PathAndCacheKey[],
    filePath: string,
  ): [RefreshIndexResults, PathAndCacheKey[]] {
    const filterFn = (item: PathAndCacheKey) => item.path === filePath;
    const compute = results.compute.filter(filterFn);
    const del = results.del.filter(filterFn);
    const addTag = results.addTag.filter(filterFn);
    const removeTag = results.removeTag.filter(filterFn);
    const newResults = {
      compute,
      del,
      addTag,
      removeTag,
    };
    const newLastUpdated = lastUpdated.filter(filterFn);
    return [newResults, newLastUpdated];
  }

  public async refreshFile(
    file: string,
    workspaceDirs: string[],
  ): Promise<void> {
    if (this.pauseToken.paused) {
      // FIXME: by returning here, there is a chance that while paused a file is modified and
      // then after unpausing the file is not reindexed
      return;
    }
    const { foundInDir } = findUriInDirs(file, workspaceDirs);
    if (!foundInDir) {
      return;
    }
    const branch = await this.ide.getBranch(foundInDir);
    const repoName = await this.ide.getRepoName(foundInDir);
    const indexesToBuild = await this.getIndexesToBuild();
    const stats = await this.ide.getFileStats([file]);
    const filePath = Object.keys(stats)[0];
    for (const index of indexesToBuild) {
      const tag = {
        directory: foundInDir,
        branch,
        artifactId: index.artifactId,
      };
      const [fullResults, fullLastUpdated, markComplete] =
        await getComputeDeleteAddRemove(
          tag,
          { ...stats },
          (filepath) => this.ide.readFile(filepath),
          repoName,
        );

      const [results, lastUpdated] = this.singleFileIndexOps(
        fullResults,
        fullLastUpdated,
        filePath,
      );
      // Don't update if nothing to update. Some of the indices might do unnecessary setup work
      if (this.totalIndexOps(results) + lastUpdated.length === 0) {
        continue;
      }

      for await (const _ of index.update(
        tag,
        results,
        markComplete,
        repoName,
      )) {
      }
    }
  }

  private async *refreshFiles(
    files: string[],
  ): AsyncGenerator<IndexingProgressUpdate> {
    let progress = 0;
    if (files.length === 0) {
      yield {
        progress: 1,
        desc: "Indexing Complete",
        status: "done",
      };
    }

    const workspaceDirs = await this.ide.getWorkspaceDirs();

    const progressPer = 1 / files.length;
    try {
      for (const file of files) {
        yield {
          progress,
          desc: `Indexing file ${file}...`,
          status: "indexing",
        };
        await this.refreshFile(file, workspaceDirs);

        progress += progressPer;

        if (this.pauseToken.paused) {
          yield* this.yieldUpdateAndPause();
        }
      }

      yield {
        progress: 1,
        desc: "Indexing Complete",
        status: "done",
      };
    } catch (err) {
      yield this.handleErrorAndGetProgressUpdate(err);
    }
  }

  async *refreshDirs(
    dirs: string[],
    abortSignal: AbortSignal,
  ): AsyncGenerator<IndexingProgressUpdate> {
    let progress = 0;

    if (dirs.length === 0) {
      yield {
        progress: 1,
        desc: "Nothing to index",
        status: "done",
      };
      return;
    }

    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return;
    }
    if (config.disableIndexing) {
      yield {
        progress,
        desc: "Indexing is disabled",
        status: "disabled",
      };
      return;
    } else {
      yield {
        progress,
        desc: "Starting indexing",
        status: "loading",
      };
    }

    // Wait until Git Extension has loaded to report progress
    // so we don't appear stuck at 0% while waiting
    await this.ide.getRepoName(dirs[0]);

    yield {
      progress,
      desc: "Starting indexing...",
      status: "loading",
    };
    const beginTime = Date.now();
    let collectedWarnings: string[] = [];

    for (const directory of dirs) {
      const dirBasename = getUriPathBasename(directory);
      yield {
        progress,
        desc: `Discovering files in ${dirBasename}...`,
        status: "indexing",
      };
      const directoryFiles = [];
      for await (const p of walkDirAsync(directory, this.ide, {
        source: "codebase indexing: refresh dirs",
      })) {
        directoryFiles.push(p);
        if (abortSignal.aborted) {
          yield {
            progress: 0,
            desc: "Indexing cancelled",
            status: "cancelled",
          };
          return;
        }
        if (this.pauseToken.paused) {
          yield* this.yieldUpdateAndPause();
        }
      }

      const branch = await this.ide.getBranch(directory);
      const repoName = await this.ide.getRepoName(directory);
      let nextLogThreshold = 0;

      for await (const updateDesc of this.indexFiles(
        directory,
        directoryFiles,
        branch,
        repoName,
      )) {
        // Handle pausing in this loop because it's the only one really taking time
        if (abortSignal.aborted) {
          yield {
            progress: 0,
            desc: "Indexing cancelled",
            status: "cancelled",
          };
          return;
        }
        if (this.pauseToken.paused) {
          yield* this.yieldUpdateAndPause();
        }

        // Collect warnings from indexFiles
        if (updateDesc.warnings && updateDesc.warnings.length > 0) {
          collectedWarnings = [...updateDesc.warnings];
        }

        yield updateDesc;
        if (updateDesc.progress >= nextLogThreshold) {
          // log progress every 2.5%
          nextLogThreshold += 0.025;
          this.logProgress(
            beginTime,
            Math.floor(directoryFiles.length * updateDesc.progress),
            updateDesc.progress,
          );
        }
      }
    }

    // Final completion message with preserved warnings
    yield {
      progress: 1,
      desc:
        collectedWarnings.length > 0
          ? `Indexing completed with ${collectedWarnings.length} warning(s)`
          : "Indexing Complete",
      status: "done",
      warnings: collectedWarnings.length > 0 ? collectedWarnings : undefined,
    };
    this.logProgress(beginTime, 0, 1);
  }

  private handleErrorAndGetProgressUpdate(
    err: unknown,
  ): IndexingProgressUpdate {
    console.log("error when indexing: ", err);
    if (err instanceof Error) {
      const cause = getRootCause(err);
      if (cause instanceof LLMError) {
        throw cause;
      }
      return this.errorToProgressUpdate(err);
    }
    return {
      progress: 0,
      desc: `Indexing failed: ${err}`,
      status: "failed",
      debugInfo: extractMinimalStackTraceInfo((err as any)?.stack),
    };
  }

  private errorToProgressUpdate(err: Error): IndexingProgressUpdate {
    const cause = getRootCause(err);
    let errMsg: string = `${cause}`;
    let shouldClearIndexes = false;

    // Check if any of the error regexes match
    for (const regexStr of this.errorsRegexesToClearIndexesOn) {
      const regex = new RegExp(regexStr);
      const match = err.message.match(regex);

      if (match !== null) {
        shouldClearIndexes = true;
        break;
      }
    }

    return {
      progress: 0,
      desc: errMsg,
      status: "failed",
      shouldClearIndexes,
      debugInfo: extractMinimalStackTraceInfo(err.stack),
    };
  }

  private logProgress(
    beginTime: number,
    completedFileCount: number,
    progress: number,
  ) {
    const timeTaken = Date.now() - beginTime;
    const seconds = Math.round(timeTaken / 1000);
    const progressPercentage = (progress * 100).toFixed(1);
    const filesPerSec = (completedFileCount / seconds).toFixed(2);
    // console.debug(
    //   `Indexing: ${progressPercentage}% complete, elapsed time: ${seconds}s, ${filesPerSec} file/sec`,
    // );
  }

  private async *yieldUpdateAndPause(): AsyncGenerator<IndexingProgressUpdate> {
    yield {
      progress: 0,
      desc: "Indexing Paused",
      status: "paused",
    };
    while (this.pauseToken.paused) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /*
   * Enables the indexing operation to be completed in batches, this is important in large
   * repositories where indexing can quickly use up all the memory available
   */
  private *batchRefreshIndexResults(
    results: RefreshIndexResults,
  ): Generator<RefreshIndexResults> {
    let curPos = 0;
    while (
      curPos < results.compute.length ||
      curPos < results.del.length ||
      curPos < results.addTag.length ||
      curPos < results.removeTag.length
    ) {
      yield {
        compute: results.compute.slice(curPos, curPos + this.filesPerBatch),
        del: results.del.slice(curPos, curPos + this.filesPerBatch),
        addTag: results.addTag.slice(curPos, curPos + this.filesPerBatch),
        removeTag: results.removeTag.slice(curPos, curPos + this.filesPerBatch),
      };
      curPos += this.filesPerBatch;
    }
  }

  private async *indexFiles(
    directory: string,
    files: string[],
    branch: string,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const stats = await this.ide.getFileStats(files);
    const indexesToBuild = await this.getIndexesToBuild();
    let completedIndexCount = 0;
    let progress = 0;
    const warnings: string[] = [];

    for (const codebaseIndex of indexesToBuild) {
      const tag: IndexTag = {
        directory,
        branch,
        artifactId: codebaseIndex.artifactId,
      };
      yield {
        progress: progress,
        desc: `Planning changes for ${codebaseIndex.artifactId} index...`,
        status: "indexing",
        warnings: warnings.length > 0 ? [...warnings] : undefined,
      };

      try {
        const [results, lastUpdated, markComplete] =
          await getComputeDeleteAddRemove(
            tag,
            { ...stats },
            (filepath) => this.ide.readFile(filepath),
            repoName,
          );
        const totalOps = this.totalIndexOps(results);
        let completedOps = 0;

        // Don't update if nothing to update. Some of the indices might do unnecessary setup work
        if (totalOps > 0) {
          for (const subResult of this.batchRefreshIndexResults(results)) {
            try {
              for await (const { desc } of codebaseIndex.update(
                tag,
                subResult,
                markComplete,
                repoName,
              )) {
                yield {
                  progress,
                  desc,
                  status: "indexing",
                  warnings: warnings.length > 0 ? [...warnings] : undefined,
                };
              }
              completedOps +=
                subResult.compute.length +
                subResult.del.length +
                subResult.addTag.length +
                subResult.removeTag.length;
              progress =
                (completedIndexCount + completedOps / totalOps) *
                (1 / indexesToBuild.length);
            } catch (err) {
              // Collect non-fatal errors as warnings and continue
              const warningMsg =
                err instanceof Error ? err.message : String(err);
              const friendlyName = this.getUserFriendlyIndexName(
                codebaseIndex.artifactId,
              );
              warnings.push(`${friendlyName}: ${warningMsg}`);
              console.warn(`${friendlyName}: ${warningMsg}`, err);

              // Complete this batch and continue with next
              completedOps +=
                subResult.compute.length +
                subResult.del.length +
                subResult.addTag.length +
                subResult.removeTag.length;
              progress =
                (completedIndexCount + completedOps / totalOps) *
                (1 / indexesToBuild.length);
            }
          }
        }

        await markComplete(lastUpdated, IndexResultType.UpdateLastUpdated);
        completedIndexCount += 1;
      } catch (err) {
        // Handle errors during planning phase
        const cause = getRootCause(err as Error);
        if (cause instanceof LLMError) {
          // LLM errors are critical, re-throw them
          throw cause;
        }

        // Collect planning errors as warnings and continue to next index
        const errorMsg = err instanceof Error ? err.message : String(err);
        const friendlyName = this.getUserFriendlyIndexName(
          codebaseIndex.artifactId,
        );
        warnings.push(`${friendlyName}: ${errorMsg}`);
        console.warn(
          `Warning during ${codebaseIndex.artifactId} planning:`,
          err,
        );
        completedIndexCount += 1;
        progress = completedIndexCount * (1 / indexesToBuild.length);
      }
    }

    // Final update with any collected warnings
    if (warnings.length > 0) {
      yield {
        progress: 1,
        desc: `Indexing completed with ${warnings.length} warning(s)`,
        status: "done",
        warnings: [...warnings],
      };
    }
  }

  // New methods using messenger directly

  private updateProgress(update: IndexingProgressUpdate) {
    this.codebaseIndexingState = update;
    if (this.messenger) {
      void this.messenger.request("indexProgress", update);
    }
  }

  private async sendIndexingErrorTelemetry(update: IndexingProgressUpdate) {
    console.debug(
      "Indexing failed with error: ",
      update.desc,
      update.debugInfo,
    );
  }

  /**
   * We want to prevent sqlite concurrent write errors
   * when there are 2 indexing happening from different windows.
   * We want the other window to wait until the first window's indexing finishes.
   * Incase the first window closes before indexing is finished,
   * we want to unlock the IndexLock by checking the last timestamp.
   */
  private async *waitForDBIndex(): AsyncGenerator<IndexingProgressUpdate> {
    let foundLock = await IndexLock.isLocked();
    while (foundLock?.locked) {
      if ((Date.now() - foundLock.timestamp) / 1000 > 10) {
        console.log(`${foundLock.dirs} is not being indexed... unlocking`);
        await IndexLock.unlock();
        break;
      }
      console.log(`indexing ${foundLock.dirs}`);
      yield {
        progress: 0,
        desc: "",
        status: "waiting",
      };
      await new Promise((resolve) => setTimeout(resolve, 1000));
      foundLock = await IndexLock.isLocked();
    }
  }

  public async wasAnyOneIndexAdded() {
    const indexes = await this.getIndexesToBuild();
    return !indexes.every((index) =>
      this.builtIndexes.some(
        (builtIndex) => builtIndex.artifactId === index.artifactId,
      ),
    );
  }

  public async refreshCodebaseIndex(paths: string[]) {
    if (!this.indexingCancellationController.signal.aborted) {
      this.indexingCancellationController.abort();
    }
    const localController = new AbortController();
    this.indexingCancellationController = localController;

    for await (const update of this.waitForDBIndex()) {
      this.updateProgress(update);
    }

    await IndexLock.lock(paths.join(", ")); // acquire the index lock to prevent multiple windows to begin indexing
    const indexLockTimestampUpdateInterval = setInterval(
      () => void IndexLock.updateTimestamp(),
      5_000,
    );

    try {
      for await (const update of this.refreshDirs(
        paths,
        localController.signal,
      )) {
        this.updateProgress(update);

        if (update.status === "failed") {
          await this.sendIndexingErrorTelemetry(update);
        }
      }
    } catch (e: any) {
      console.log(`Failed refreshing codebase index directories: ${e}`);
      await this.handleIndexingError(e);
    }

    clearInterval(indexLockTimestampUpdateInterval); // interval will also be cleared when window closes before indexing is finished
    await IndexLock.unlock();

    // Directly refresh submenu items
    if (this.messenger) {
      this.messenger.send("refreshSubmenuItems", {
        providers: "all",
      });
    }
    if (this.indexingCancellationController === localController) {
      this.indexingCancellationController.abort();
    }
  }

  public async refreshCodebaseIndexFiles(files: string[]) {
    // Can be cancelled by codebase index but not vice versa
    if (!this.indexingCancellationController.signal.aborted) {
      return;
    }
    const localController = new AbortController();
    this.indexingCancellationController = localController;

    try {
      for await (const update of this.refreshFiles(files)) {
        this.updateProgress(update);

        if (update.status === "failed") {
          await this.sendIndexingErrorTelemetry(update);
        }
      }
    } catch (e: any) {
      console.log(`Failed refreshing codebase index files: ${e}`);
      await this.handleIndexingError(e);
    }

    // Directly refresh submenu items
    if (this.messenger) {
      this.messenger.send("refreshSubmenuItems", {
        providers: "all",
      });
    }
    if (this.indexingCancellationController === localController) {
      this.indexingCancellationController.abort();
    }
  }

  public async handleIndexingError(e: any) {
    if (e instanceof LLMError && this.messenger) {
      // Need to report this specific error to the IDE for special handling
      void this.messenger.request("reportError", e);
    }

    // broadcast indexing error
    const updateToSend: IndexingProgressUpdate = {
      progress: 0,
      status: "failed",
      desc: e.message,
    };

    this.updateProgress(updateToSend);
    void this.sendIndexingErrorTelemetry(updateToSend);
  }

  public get currentIndexingState(): IndexingProgressUpdate {
    return this.codebaseIndexingState;
  }

  private hasIndexingContextProvider() {
    return !!this.config.contextProviders?.some(
      ({ description: { dependsOnIndexing } }) => dependsOnIndexing,
    );
  }

  private isIndexingConfigSame(
    config1: ContinueConfig | undefined,
    config2: ContinueConfig,
  ) {
    return embedModelsAreEqual(
      config1?.selectedModelByRole.embed,
      config2.selectedModelByRole.embed,
    );
  }

  private async handleConfigUpdate({
    config: newConfig,
  }: ConfigResult<ContinueConfig>) {
    if (newConfig) {
      const ideSettings = await this.ide.getIdeSettings();
      const pauseCodebaseIndexOnStart = ideSettings.pauseCodebaseIndexOnStart;
      if (pauseCodebaseIndexOnStart) {
        this.paused = true;
      }

      const needsReindex = !this.isIndexingConfigSame(this.config, newConfig);

      this.config = newConfig; // IMPORTANT - need to set up top, other methods below use this without passing it in

      // No point in indexing if no codebase context provider
      const hasIndexingProviders = this.hasIndexingContextProvider();
      if (!hasIndexingProviders) {
        return;
      }

      // Skip codebase indexing if not supported
      // No warning message here because would show on ANY config update
      if (!this.config.selectedModelByRole.embed) {
        return;
      }

      if (needsReindex) {
        const dirs = await this.ide.getWorkspaceDirs();
        void this.refreshCodebaseIndex(dirs);
      }
    }
  }
}
