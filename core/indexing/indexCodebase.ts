import { IDE, IndexTag, IndexingProgressUpdate } from "..";
import { ConfigHandler } from "../config/handler";
import { ContinueServerClient } from "../continueServer/stubs/client";
import { CodeSnippetsCodebaseIndex } from "./CodeSnippetsIndex";
import { FullTextSearchCodebaseIndex } from "./FullTextSearch";
import { LanceDbIndex } from "./LanceDbIndex";
import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex";
import { getComputeDeleteAddRemove } from "./refreshIndex";
import { CodebaseIndex } from "./types";

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
  private continueServerClient?: ContinueServerClient;
  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly pauseToken: PauseToken,
    private readonly continueServerUrl: string | undefined,
    private readonly userToken: Promise<string | undefined>,
  ) {
    if (continueServerUrl) {
      this.continueServerClient = new ContinueServerClient(
        continueServerUrl,
        userToken,
      );
    }
  }

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
  ): AsyncGenerator<IndexingProgressUpdate> {
    const config = await this.configHandler.loadConfig();
    if (config.disableIndexing) {
      return;
    }

    const indexesToBuild = await this.getIndexesToBuild();

    let completedDirs = 0;

    yield {
      progress: 0.01,
      desc: "Starting indexing...",
    };

    for (let directory of workspaceDirs) {
      const stats = await this.ide.getStats(directory);
      const branch = await this.ide.getBranch(directory);
      let completedIndexes = 0;

      try {
        for (let codebaseIndex of indexesToBuild) {
          const tag: IndexTag = {
            directory,
            branch,
            artifactId: codebaseIndex.artifactId,
          };
          const [results, markComplete] = await getComputeDeleteAddRemove(
            tag,
            { ...stats },
            (filepath) => this.ide.readFile(filepath),
          );

          for await (let { progress, desc } of codebaseIndex.update(
            tag,
            results,
            markComplete,
          )) {
            // Handle pausing in this loop because it's the only one really taking time
            while (this.pauseToken.paused) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            yield {
              progress:
                (completedDirs +
                  (completedIndexes + progress) / indexesToBuild.length) /
                workspaceDirs.length,
              desc,
            };
          }
          completedIndexes++;
          yield {
            progress:
              (completedDirs + completedIndexes / indexesToBuild.length) /
              workspaceDirs.length,
            desc: "Completed indexing " + codebaseIndex.artifactId,
          };
        }
      } catch (e) {
        console.warn("Error refreshing index: ", e);
      }

      completedDirs++;
      yield {
        progress: completedDirs / workspaceDirs.length,
        desc: "Indexing Complete",
      };
    }
  }
}
