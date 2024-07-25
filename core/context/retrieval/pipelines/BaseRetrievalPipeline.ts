import {
  BranchAndDir,
  Chunk,
  EmbeddingsProvider,
  IDE,
  Reranker,
} from "../../..";
import { chunkDocument } from "../../../indexing/chunk/chunk";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex";
import { MAX_CHUNK_SIZE } from "../../../llm/constants";
import { retrieveFts } from "../fullTextSearch";
import { recentlyEditedFilesCache } from "../recentlyEditedFilesCache";

export interface RetrievalPipelineOptions {
  ide: IDE;
  embeddingsProvider: EmbeddingsProvider;
  reranker: Reranker | undefined;

  input: string;
  nRetrieve: number;
  nFinal: number;
  tags: BranchAndDir[];
  filterDirectory?: string;
}

export interface IRetrievalPipeline {
  run(options: RetrievalPipelineOptions): Promise<Chunk[]>;
}

export default class BaseRetrievalPipeline implements IRetrievalPipeline {
  private lanceDbIndex: LanceDbIndex;
  constructor(protected readonly options: RetrievalPipelineOptions) {
    this.lanceDbIndex = new LanceDbIndex(options.embeddingsProvider, (path) =>
      options.ide.readFile(path),
    );
  }

  protected async calculateAndRetrieveRecentlyEditedFiles(
    n: number,
  ): Promise<Chunk[]> {
    const recentlyEditedFilesRetrieveSlice = Array.from(
      recentlyEditedFilesCache.keys(),
    ).slice(0, n);

    // If the number of recently edited files is less than the retrieval limit,
    // include additional open files. This is useful in the case where a user
    // has many tabs open and reloads their IDE. They now have 0 recently edited files,
    // but many open tabs that represent what they were working on prior to reload.
    if (recentlyEditedFilesRetrieveSlice.length < n) {
      const openFiles = await this.options.ide.getOpenFiles();
      recentlyEditedFilesRetrieveSlice.push(
        ...openFiles.slice(0, n - recentlyEditedFilesRetrieveSlice.length),
      );
    }

    const chunks: Chunk[] = [];

    for (const filepath of recentlyEditedFilesRetrieveSlice) {
      const fileContents = await this.options.ide.readFile(filepath);
      const fileChunks = chunkDocument(
        filepath,
        fileContents,
        MAX_CHUNK_SIZE,
        filepath, // TODO: Is this fine since we aren't storing this anywhere?
      );

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
