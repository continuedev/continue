import * as fs from "fs/promises";

import { ConfigHandler } from "../config/ConfigHandler.js";
import { IContinueServerClient } from "../continueServer/interface.js";
import { IDE, IndexingProgressUpdate, IndexTag } from "../index.js";
import { extractMinimalStackTraceInfo } from "../util/extractMinimalStackTraceInfo.js";
import { getIndexSqlitePath, getLanceDbPath } from "../util/paths.js";
import { findUriInDirs, getUriPathBasename } from "../util/uri.js";

import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex.js";
import { CodeSnippetsCodebaseIndex } from "./CodeSnippetsIndex.js";
import { FullTextSearchCodebaseIndex } from "./FullTextSearchCodebaseIndex.js";
import { LanceDbIndex } from "./LanceDbIndex.js";
import { getComputeDeleteAddRemove } from "./refreshIndex.js";
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
  filesPerBatch = 500;

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
    private readonly pauseToken: PauseToken,
    private readonly continueServerClient: IContinueServerClient,
  ) {}

  async clearIndexes() {
    const sqliteFilepath = getIndexSqlitePath();
    const lanceDbFolder = getLanceDbPath();

    try {
      await fs.unlink(sqliteFilepath);
    } catch (error) {
      console.error(`Error deleting ${sqliteFilepath} folder: ${error}`);
    }

    try {
      await fs.rm(lanceDbFolder, { recursive: true, force: true });
    } catch (error) {
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

    const indexes: CodebaseIndex[] = [
      new ChunkCodebaseIndex(
        this.ide.readFile.bind(this.ide),
        this.continueServerClient,
        embeddingsModel.maxEmbeddingChunkSize,
      ), // Chunking must come first
    ];

    const lanceDbIndex = await LanceDbIndex.create(
      embeddingsModel,
      this.ide.readFile.bind(this.ide),
      this.continueServerClient,
    );

    if (lanceDbIndex) {
      indexes.push(lanceDbIndex);
    }

    indexes.push(
      new FullTextSearchCodebaseIndex(),
      new CodeSnippetsCodebaseIndex(this.ide),
    );

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
      // NOTE: by returning here, there is a chance that while paused a file is modified and
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

  async *refreshFiles(files: string[]): AsyncGenerator<IndexingProgressUpdate> {
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
    if (config?.disableIndexing) {
      yield {
        progress,
        desc: "Indexing is disabled in config.json",
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

      try {
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
      } catch (err) {
        yield this.handleErrorAndGetProgressUpdate(err);
        return;
      }
    }
    yield {
      progress: 1,
      desc: "Indexing Complete",
      status: "done",
    };
    this.logProgress(beginTime, 0, 1);
  }

  private handleErrorAndGetProgressUpdate(
    err: unknown,
  ): IndexingProgressUpdate {
    console.log("error when indexing: ", err);
    if (err instanceof Error) {
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
    let errMsg: string = `${err}`;
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
      };
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
          for await (const { desc } of codebaseIndex.update(
            tag,
            subResult,
            markComplete,
            repoName,
          )) {
            yield {
              progress: progress,
              desc,
              status: "indexing",
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
        }
      }

      await markComplete(lastUpdated, IndexResultType.UpdateLastUpdated);
      completedIndexCount += 1;
    }
  }
}
