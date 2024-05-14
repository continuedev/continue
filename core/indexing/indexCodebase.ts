import { ConfigHandler } from "../config/handler.js";
import { IContinueServerClient } from "../continueServer/interface.js";
import { IDE, IndexTag, IndexingProgressUpdate } from "../index.js";
import { CodeSnippetsCodebaseIndex } from "./CodeSnippetsIndex.js";
import { FullTextSearchCodebaseIndex } from "./FullTextSearch.js";
import { LanceDbIndex } from "./LanceDbIndex.js";
import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex.js";
import { getComputeDeleteAddRemove } from "./refreshIndex.js";
import { CodebaseIndex } from "./types.js";

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

  async *refresh(
    workspaceDirs: string[],
    abortSignal: AbortSignal,
  ): AsyncGenerator<IndexingProgressUpdate> {
    if (workspaceDirs.length === 0) {
      return;
    }

    const config = await this.configHandler.loadConfig();
    if (config.disableIndexing) {
      return;
    }

    const indexesToBuild = await this.getIndexesToBuild();

    let completedDirs = 0;

    // Wait until Git Extension has loaded to report progress
    // so we don't appear stuck at 0% while waiting
    await this.ide.getRepoName(workspaceDirs[0]);

    yield {
      progress: 0,
      desc: "Starting indexing...",
      status: "starting",
    };

    for (let directory of workspaceDirs) {
      const stats = await this.ide.getStats(directory);
      const branch = await this.ide.getBranch(directory);
      const repoName = await this.ide.getRepoName(directory);
      let completedIndexes = 0;

      for (let codebaseIndex of indexesToBuild) {
        // TODO: IndexTag type should use repoName rather than directory
        const tag: IndexTag = {
          directory,
          branch,
          artifactId: codebaseIndex.artifactId,
        };
        const [results, markComplete] = await getComputeDeleteAddRemove(
          tag,
          { ...stats },
          (filepath) => this.ide.readFile(filepath),
          repoName,
        );

        try {
          for await (let { progress, desc } of codebaseIndex.update(
            tag,
            results,
            markComplete,
            repoName,
          )) {
            // Handle pausing in this loop because it's the only one really taking time
            if (abortSignal.aborted) {
              yield {
                progress: 1,
                desc: "Indexing cancelled",
                status: "failed",
              };
              return;
            }
            while (this.pauseToken.paused) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            yield {
              progress:
                (completedDirs +
                  (completedIndexes + progress) / indexesToBuild.length) /
                workspaceDirs.length,
              desc,
              status: "indexing",
            };
          }
          completedIndexes++;
          yield {
            progress:
              (completedDirs + completedIndexes / indexesToBuild.length) /
              workspaceDirs.length,
            desc: "Completed indexing " + codebaseIndex.artifactId,
            status: "indexing",
          };
        } catch (e) {
          console.warn(
            `Error updating the ${codebaseIndex.artifactId} index: ${e}`,
          );
        }
      }

      completedDirs++;
      yield {
        progress: completedDirs / workspaceDirs.length,
        desc: "Indexing Complete",
        status: "done",
      };
    }
  }
}
