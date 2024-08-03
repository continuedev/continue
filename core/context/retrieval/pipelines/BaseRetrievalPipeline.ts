import {
  BranchAndDir,
  Chunk,
  EmbeddingsProvider,
  IDE,
  Reranker,
} from "../../../index.js";
import { FullTextSearchCodebaseIndex } from "../../../indexing/FullTextSearch.js";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex.js";
// @ts-ignore
import nlp from "wink-nlp-utils";

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
  private ftsIndex = new FullTextSearchCodebaseIndex();

  private lanceDbIndex: LanceDbIndex;
  constructor(protected readonly options: RetrievalPipelineOptions) {
    this.lanceDbIndex = new LanceDbIndex(options.embeddingsProvider, (path) =>
      options.ide.readFile(path),
    );
  }

  private getCleanedTrigrams(
    query: RetrievalPipelineRunArguments["query"],
  ): string[] {
    let text = nlp.string.removeExtraSpaces(query);
    text = nlp.string.stem(text);

    let tokens = nlp.string
      .tokenize(text, true)
      .filter((token: any) => token.tag === "word")
      .map((token: any) => token.value);

    tokens = nlp.tokens.removeWords(tokens);
    tokens = nlp.tokens.setOfWords(tokens);

    const cleanedTokens = [...tokens].join(" ");
    const trigrams = nlp.string.ngram(cleanedTokens, 3);

    return trigrams;
  }

  protected async retrieveFts(
    args: RetrievalPipelineRunArguments,
    n: number,
  ): Promise<Chunk[]> {
    try {
      if (args.query.trim() === "") {
        return [];
      }

      const tokens = this.getCleanedTrigrams(args.query).join(" OR ");

      return await this.ftsIndex.retrieve({
        n,
        text: tokens,
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
