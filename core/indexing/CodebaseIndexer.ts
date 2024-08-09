import { ConfigHandler } from "../config/ConfigHandler.js";
import { IContinueServerClient } from "../continueServer/interface.js";
import { IDE, IndexTag, IndexingProgressUpdate } from "../index.js";
import { CodeSnippetsCodebaseIndex } from "./CodeSnippetsIndex.js";
import { FullTextSearchCodebaseIndex } from "./FullTextSearch.js";
import { LanceDbIndex } from "./LanceDbIndex.js";
import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex.js";
import { getComputeDeleteAddRemove } from "./refreshIndex.js";
import {
  CodebaseIndex,
  IndexResultType,
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
  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly pauseToken: PauseToken,
    private readonly continueServerClient: IContinueServerClient,
  ) {}

  private async getIndexesToBuild(): Promise<CodebaseIndex[]> {
    const config = await this.configHandler.loadConfig();

    const indexes = [
      new ChunkCodebaseIndex(
        this.ide.readFile.bind(this.ide),
        this.continueServerClient,
        config.embeddingsProvider.maxChunkSize,
      ), // Chunking must come first
      new LanceDbIndex(
        config.embeddingsProvider,
        this.ide.readFile.bind(this.ide),
        this.continueServerClient,
      ),
      new FullTextSearchCodebaseIndex(),
      new CodeSnippetsCodebaseIndex(this.ide),
    ];

    return indexes;
  }

  public async refreshFile(file: string): Promise<void> {
    if (this.pauseToken.paused) {
      // NOTE: by returning here, there is a chance that while paused a file is modified and
      // then after unpausing the file is not reindexed
      return;
    }
    const workspaceDir = await this.getWorkspaceDir(file);
    if (!workspaceDir) {
      return;
    }
    const branch = await this.ide.getBranch(workspaceDir);
    const repoName = await this.ide.getRepoName(workspaceDir);
    const indexesToBuild = await this.getIndexesToBuild();
    const stats = await this.ide.getLastModified([file]);
    for (const index of indexesToBuild) {
      const tag = {
        directory: workspaceDir,
        branch,
        artifactId: index.artifactId,
      };
      const [results, lastUpdated, markComplete] =
        await getComputeDeleteAddRemove(
          tag,
          { ...stats },
          (filepath) => this.ide.readFile(filepath),
          repoName,
        );
      // since this is only a single file update / save we do not want to actualy remove anything, we just want to recompute for our single file
      results.removeTag = [];
      results.addTag = [];
      results.del = [];
      for await (const _ of index.update(
        tag,
        results,
        markComplete,
        repoName,
      )) {
      }
    }
  }

  async *refresh(
    workspaceDirs: string[],
    abortSignal: AbortSignal,
  ): AsyncGenerator<IndexingProgressUpdate> {
    let progress = 0;

    if (workspaceDirs.length === 0) {
      yield {
        progress,
        desc: "Nothing to index",
        status: "disabled",
      };
      return;
    }

    const config = await this.configHandler.loadConfig();
    if (config.disableIndexing) {
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

    let completedDirs = 0;

    // Wait until Git Extension has loaded to report progress
    // so we don't appear stuck at 0% while waiting
    await this.ide.getRepoName(workspaceDirs[0]);

    yield {
      progress,
      desc: "Starting indexing...",
      status: "loading",
    };
    const beginTime = Date.now();

    for (const directory of workspaceDirs) {
      const dirBasename = await this.basename(directory);
      yield {
        progress,
        desc: `Discovering files in ${dirBasename}...`,
        status: "indexing",
      };
      const workspaceFiles = [];
      for await (const p of walkDirAsync(directory, this.ide)) {
        workspaceFiles.push(p);
        if (abortSignal.aborted) {
          yield {
            progress: 1,
            desc: "Indexing cancelled",
            status: "disabled",
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
          workspaceFiles,
          branch,
          repoName,
        )) {
          // Handle pausing in this loop because it's the only one really taking time
          if (abortSignal.aborted) {
            yield {
              progress: 1,
              desc: "Indexing cancelled",
              status: "disabled",
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
              Math.floor(workspaceFiles.length * updateDesc.progress),
              updateDesc.progress,
            );
          }
        }
      } catch (err) {
        yield this.handleErrorAndGetProgressUpdate(err);
        return;
      }
      completedDirs += 1;
    }
    yield {
      progress: 100,
      desc: "Indexing Complete",
      status: "done",
    };
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
    };
  }

  private errorToProgressUpdate(err: Error): IndexingProgressUpdate {
    const errorRegex =
      /Invalid argument error: Values length (\d+) is less than the length \((\d+)\) multiplied by the value size \(\d+\)/;
    const match = err.message.match(errorRegex);
    let errMsg: string;
    if (match) {
      const [_, valuesLength, expectedLength] = match;
      errMsg = `Generated embedding had length ${valuesLength} but was expected to be ${expectedLength}. This may be solved by deleting ~/.continue/index and refreshing the window to re-index.`;
    } else {
      errMsg = `${err}`;
    }
    return {
      progress: 0,
      desc: errMsg,
      status: "failed",
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
    console.debug(
      `Indexing: ${progressPercentage}% complete, elapsed time: ${seconds}s, ${filesPerSec} file/sec`,
    );
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

  private getBatchSize(workspaceSize: number): number {
    // at least 10 and as much as 100 (in a repository with 10000 files)
    return Math.min(100, Math.max(10, Math.floor(workspaceSize / 100)));
  }

  /*
   * enables the indexing operation to be completed in small batches, this is important in large
   * repositories where indexing can quickly use up all the memory available
   */
  private *batchRefreshIndexResults(
    results: RefreshIndexResults,
    workspaceSize: number,
  ): Generator<RefreshIndexResults> {
    let curPos = 0;
    const batchSize = this.getBatchSize(workspaceSize);
    while (
      curPos < results.compute.length ||
      curPos < results.del.length ||
      curPos < results.addTag.length ||
      curPos < results.removeTag.length
    ) {
      yield {
        compute: results.compute.slice(curPos, curPos + batchSize),
        del: results.del.slice(curPos, curPos + batchSize),
        addTag: results.addTag.slice(curPos, curPos + batchSize),
        removeTag: results.removeTag.slice(curPos, curPos + batchSize),
      };
      curPos += batchSize;
    }
  }

  private async *indexFiles(
    workspaceDir: string,
    workspaceFiles: string[],
    branch: string,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const stats = await this.ide.getLastModified(workspaceFiles);
    const indexesToBuild = await this.getIndexesToBuild();
    let completedIndexCount = 0;
    let progress = 0;
    for (const codebaseIndex of indexesToBuild) {
      const tag: IndexTag = {
        directory: workspaceDir,
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
      const totalOps =
        results.compute.length +
        results.del.length +
        results.addTag.length +
        results.removeTag.length;
      let completedOps = 0;
      for (const subResult of this.batchRefreshIndexResults(
        results,
        workspaceFiles.length,
      )) {
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
      await markComplete(lastUpdated, IndexResultType.UpdateLastUpdated);
      completedIndexCount += 1;
    }
  }

  private async getWorkspaceDir(filepath: string): Promise<string | undefined> {
    const workspaceDirs = await this.ide.getWorkspaceDirs();
    for (const workspaceDir of workspaceDirs) {
      if (filepath.startsWith(workspaceDir)) {
        return workspaceDir;
      }
    }
    return undefined;
  }

  private async basename(filepath: string): Promise<string> {
    const pathSep = await this.ide.pathSep();
    const path = filepath.split(pathSep);
    return path[path.length - 1];
  }
}
