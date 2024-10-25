import {
  BranchAndDir,
  Chunk,
  ContinueConfig,
  IDE,
  ILLM,
} from "../../../index.js";
import { chunkDocument } from "../../../indexing/chunk/chunk.js";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex.js";
import { retrieveFts } from "../fullTextSearch.js";
import { recentlyEditedFilesCache } from "../recentlyEditedFilesCache.js";

export interface RetrievalPipelineOptions {
  llm: ILLM;
  config: ContinueConfig;
  ide: IDE;

  input: string;
  nRetrieve: number;
  nFinal: number;
  tags: BranchAndDir[];
  pathSep: string;
  filterDirectory?: string;
}

export interface IRetrievalPipeline {
  run(options: RetrievalPipelineOptions): Promise<Chunk[]>;
}

export default class BaseRetrievalPipeline implements IRetrievalPipeline {
  private lanceDbIndex: LanceDbIndex;
  constructor(protected readonly options: RetrievalPipelineOptions) {
    this.lanceDbIndex = new LanceDbIndex(
      options.config.embeddingsProvider,
      (path) => options.ide.readFile(path),
      options.pathSep,
    );
  }

  protected async retrieveAndChunkRecentlyEditedFiles(
    n: number,
  ): Promise<Chunk[]> {
    const recentlyEditedFilesSlice = Array.from(
      recentlyEditedFilesCache.keys(),
    ).slice(0, n);

    // If the number of recently edited files is less than the retrieval limit,
    // include additional open files. This is useful in the case where a user
    // has many tabs open and reloads their IDE. They now have 0 recently edited files,
    // but many open tabs that represent what they were working on prior to reload.
    if (recentlyEditedFilesSlice.length < n) {
      const openFiles = await this.options.ide.getOpenFiles();
      recentlyEditedFilesSlice.push(
        ...openFiles.slice(0, n - recentlyEditedFilesSlice.length),
      );
    }

    const chunks: Chunk[] = [];

    for (const filepath of recentlyEditedFilesSlice) {
      const contents = await this.options.ide.readFile(filepath);
      const fileChunks = chunkDocument({
        filepath,
        contents,
        maxChunkSize: this.options.config.embeddingsProvider.maxChunkSize,
        digest: filepath,
      });

      for await (const chunk of fileChunks) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  protected async retrieveFts(input: string, n: number): Promise<Chunk[]> {
    return retrieveFts(
      input,
      n,
      this.options.tags,
      this.options.filterDirectory,
    );
  }

  protected async retrieveEmbeddings(
    input: string,
    n: number,
  ): Promise<Chunk[]> {
    return this.lanceDbIndex.retrieve(
      input,
      n,
      this.options.tags,
      this.options.filterDirectory,
    );
  }

  run(): Promise<Chunk[]> {
    throw new Error("Not implemented");
  }
}
