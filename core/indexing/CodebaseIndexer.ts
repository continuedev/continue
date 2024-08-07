import { ConfigHandler } from "../config/ConfigHandler.js";
import { IContinueServerClient } from "../continueServer/interface.js";
import { IDE, IndexTag, IndexingProgressUpdate } from "../index.js";
import { CodeSnippetsCodebaseIndex } from "./CodeSnippetsIndex.js";
import { FullTextSearchCodebaseIndex } from "./FullTextSearch.js";
import { LanceDbIndex } from "./LanceDbIndex.js";
import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex.js";
import { getComputeDeleteAddRemove } from "./refreshIndex.js";
import { CodebaseIndex, IndexResultType } from "./types.js";
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
    for await (const updateDesc of this.indexFiles(workspaceDir, branch, repoName, [file])) {
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

    const indexesToBuild = await this.getIndexesToBuild();
    let completedDirs = 0;
    const totalRelativeExpectedTime = indexesToBuild.reduce(
      (sum, index) => sum + index.relativeExpectedTime,
      0,
    );

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
        status: "indexing"
      };
      // compute the number of files in this directory to display an accurate progress bar
      let totalFileCount = 0;
      for await (const p of walkDirAsync(directory, this.ide)) {
        totalFileCount += 1;
        if (abortSignal.aborted) {
          yield {
            progress: 1,
            desc: "Indexing cancelled",
            status: "disabled",
          };
          return;
        }
        if (this.pauseToken.paused) {
          yield *this.yieldUpdateAndPause();
        }
      }

      const branch = await this.ide.getBranch(directory);
      const repoName = await this.ide.getRepoName(directory);
      const batchSize = this.getBatchSize(totalFileCount);
      let completedFileCount = 0;

      for await (const files of this.walkDirInBatches(directory, batchSize)) {
        try {
          for await (const updateDesc of this.indexFiles(directory, branch, repoName, files)) {
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
              yield *this.yieldUpdateAndPause();
            }
            yield {
              progress: progress,
              desc: updateDesc,
              status: "indexing",
            };
          }
        } catch (err) {
          yield this.handleErrorAndGetProgressUpdate(err);
          return;
        }
        completedFileCount += files.length;
        progress = completedFileCount / totalFileCount / workspaceDirs.length + completedDirs / workspaceDirs.length;
        this.logProgress(beginTime, completedFileCount, progress);
      }
      completedDirs += 1;
    }
    yield {
      progress: 100,
      desc: "Indexing Complete",
      status: "done",
    };
  }

  private handleErrorAndGetProgressUpdate(err: unknown): IndexingProgressUpdate {
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

  private logProgress(beginTime: number, completedFileCount: number, progress: number) {
    const timeTaken = Date.now() - beginTime;
    const seconds = Math.round(timeTaken / 1000);
    const progressPercentage = (progress * 100).toFixed(1);
    const filesPerSec = (completedFileCount / seconds).toFixed(2);
    console.log(`Indexing: ${progressPercentage}% complete, elapsed time: ${seconds}s, ${filesPerSec} file/sec`);
  }

  private async* yieldUpdateAndPause(): AsyncGenerator<IndexingProgressUpdate> {
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
  private async* walkDirInBatches(directory: string, batchSize: number): AsyncGenerator<string[]> {
    let results = [];
    for await (const p of walkDirAsync(directory, this.ide)) {
      results.push(p);
      if (results.length === batchSize) {
        yield results;
        results = [];
      }
    }
    if (results.length > 0) {
      yield results;
    }
  }

  private async* indexFiles(workspaceDir: string, branch: string, repoName: string | undefined, filePaths: string[]): AsyncGenerator<string> {
    const stats = await this.ide.getLastModified(filePaths);
    const indexesToBuild = await this.getIndexesToBuild();
    for (const codebaseIndex of indexesToBuild) {
      const tag: IndexTag = {
        directory: workspaceDir,
        branch,
        artifactId: codebaseIndex.artifactId,
      };
      const [results, lastUpdated, markComplete] = await getComputeDeleteAddRemove(
        tag,
        { ...stats },
        (filepath) => this.ide.readFile(filepath),
        repoName,
      );
      for await (const { desc } of codebaseIndex.update(tag, results, markComplete, repoName)) {
        lastUpdated.forEach((lastUpdated, path) => {
          markComplete([lastUpdated], IndexResultType.UpdateLastUpdated);
        });
        yield desc;
      }
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
