import {
  BranchAndDir,
  Chunk,
  EmbeddingsProvider,
  IDE,
  Reranker,
} from "../../..";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex";
import { retrieveFts } from "../fullTextSearch";

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
