import {
  BranchAndDir,
  Chunk,
  EmbeddingsProvider,
  IDE,
  Reranker,
} from "../../../index.js";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex.js";
import { retrieveFts } from "../fullTextSearch.js";

export interface RetrievalPipelineOptions {
  embeddingsProvider: EmbeddingsProvider;
  reranker: Reranker | undefined;
  nRetrieve: number;
  nFinal: number;
  ide: IDE;
}

export interface RetrievalPipelineRunArguments {
  query: string;
  tags: BranchAndDir[];
  filterDirectory?: string;
  // ide?: IDE;
}

export interface IRetrievalPipeline {
  run(args: RetrievalPipelineRunArguments): Promise<Chunk[]>;
}

export default class BaseRetrievalPipeline implements IRetrievalPipeline {
  private lanceDbIndex: LanceDbIndex;
  constructor(protected readonly options: RetrievalPipelineOptions) {
    this.lanceDbIndex = new LanceDbIndex(options.embeddingsProvider, (path) =>
      options.ide.readFile(path),
    );
  }

  protected async retrieveFts(
    args: RetrievalPipelineRunArguments,
    n: number,
  ): Promise<Chunk[]> {
    return retrieveFts(args, n);
  }

  protected async retrieveEmbeddings(
    args: RetrievalPipelineRunArguments,
    n: number,
  ): Promise<Chunk[]> {
    return this.lanceDbIndex.retrieve(args, n);
  }

  run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    throw new Error("Not implemented");
  }
}
