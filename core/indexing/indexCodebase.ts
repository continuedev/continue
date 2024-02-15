import { IDE, IndexingProgressUpdate } from "..";
import { ConfigHandler } from "../config/handler";
import { FullTextSearchCodebaseIndex } from "./FullTextSearch";
import { LanceDbIndex } from "./LanceDbIndex";
import { ChunkCodebaseIndex } from "./chunk/ChunkCodebaseIndex";
import { getComputeDeleteAddRemove } from "./refreshIndex";
import { CodebaseIndex, IndexTag } from "./types";

export class CodebaseIndexer {
  configHandler: ConfigHandler;
  ide: IDE;
  constructor(configHandler: ConfigHandler, ide: IDE) {
    this.configHandler = configHandler;
    this.ide = ide;
  }

  private async getIndexesToBuild(): Promise<CodebaseIndex[]> {
    const config = await this.configHandler.loadConfig();

    const indexes = [
      new ChunkCodebaseIndex(this.ide.readFile.bind(this.ide)), // Chunking must come first
      new LanceDbIndex(
        config.embeddingsProvider,
        this.ide.readFile.bind(this.ide)
      ),
      new FullTextSearchCodebaseIndex(),
    ];

    return indexes;
  }

  async *refresh(
    workspaceDirs: string[]
  ): AsyncGenerator<IndexingProgressUpdate> {
    const config = await this.configHandler.loadConfig();
    if (config.disableIndexing) {
      return;
    }

    const indexesToBuild = await this.getIndexesToBuild();

    let completedDirs = 0;

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
            (filepath) => this.ide.readFile(filepath)
          );

          for await (let { progress, desc } of codebaseIndex.update(
            tag,
            results,
            markComplete
          )) {
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
