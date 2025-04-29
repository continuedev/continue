// @ts-ignore
import nlp from "wink-nlp-utils";

import { BranchAndDir, Chunk, ContinueConfig, IDE, ILLM } from "../../../";
import { chunkDocument } from "../../../indexing/chunk/chunk";
import { FullTextSearchCodebaseIndex } from "../../../indexing/FullTextSearchCodebaseIndex";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex";
import { recentlyEditedFilesCache } from "../recentlyEditedFilesCache";

const DEFAULT_CHUNK_SIZE = 384;

export interface RetrievalPipelineOptions {
  llm: ILLM;
  config: ContinueConfig;
  ide: IDE;
  input: string;
  nRetrieve: number;
  nFinal: number;
  tags: BranchAndDir[];
  filterDirectory?: string;
}

export interface RetrievalPipelineRunArguments {
  query: string;
  tags: BranchAndDir[];
  filterDirectory?: string;
  includeEmbeddings: boolean;
}

export interface IRetrievalPipeline {
  run(args: RetrievalPipelineRunArguments): Promise<Chunk[]>;
}

export default class BaseRetrievalPipeline implements IRetrievalPipeline {
  private ftsIndex = new FullTextSearchCodebaseIndex();
  private lanceDbIndex: LanceDbIndex | null = null;

  constructor(protected readonly options: RetrievalPipelineOptions) {
    void this.initLanceDb();
  }

  private async initLanceDb() {
    const embedModel = this.options.config.selectedModelByRole.embed;

    if (!embedModel) {
      return;
    }

    this.lanceDbIndex = await LanceDbIndex.create(embedModel, (uri) =>
      this.options.ide.readFile(uri),
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

    return trigrams.map(this.escapeFtsQueryString);
  }

  private escapeFtsQueryString(query: string): string {
    const escapedDoubleQuotes = query.replace(/"/g, '""');
    return `"${escapedDoubleQuotes}"`;
  }

  protected async retrieveFts(
    args: RetrievalPipelineRunArguments,
    n: number,
  ): Promise<Chunk[]> {
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
        maxChunkSize:
          this.options.config.selectedModelByRole.embed
            ?.maxEmbeddingChunkSize ?? DEFAULT_CHUNK_SIZE,
        digest: filepath,
      });

      for await (const chunk of fileChunks) {
        chunks.push(chunk);
      }
    }

    return chunks.slice(0, n);
  }

  protected async retrieveEmbeddings(
    input: string,
    n: number,
  ): Promise<Chunk[]> {
    if (!this.lanceDbIndex) {
      console.warn(
        "LanceDB index not available, skipping embeddings retrieval",
      );
      return [];
    }

    return this.lanceDbIndex.retrieve(
      input,
      n,
      this.options.tags,
      this.options.filterDirectory,
    );
  }

  run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    throw new Error("Not implemented");
  }
}
