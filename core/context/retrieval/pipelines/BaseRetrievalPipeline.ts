import {
  BranchAndDir,
  Chunk,
  EmbeddingsProvider,
  IDE,
  Reranker,
} from "../../../index.js";
import {
  FullTextSearchCodebaseIndex,
  RetrieveConfig,
} from "../../../indexing/FullTextSearch.js";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex.js";

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
    matchOn?: RetrieveConfig["matchOn"],
  ): Promise<Chunk[]> {
    try {
      const ftsIndex = new FullTextSearchCodebaseIndex();

      if (args.query.trim() === "") {
        return [];
      }

      const text = args.query
        .trim()
        .split(" ")
        .map((element) => `"${element}"`)
        .join(" OR ");

      return await ftsIndex.retrieve({
        text,
        n,
        matchOn,
        tags: args.tags,
        directory: args.filterDirectory,
      });
    } catch (e) {
      console.warn("Error retrieving from FTS:", e);
      return [];
    }
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
