import { Chunk } from "../../..";
import { Telemetry } from "../../../util/posthog";
import { findUriInDirs } from "../../../util/uri";
import { requestFilesFromRepoMap } from "../repoMapRequest";
import { deduplicateChunks } from "../util";

import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "./BaseRetrievalPipeline";

export default class RerankerRetrievalPipeline extends BaseRetrievalPipeline {
  private async _retrieveInitial(
    args: RetrievalPipelineRunArguments,
  ): Promise<Chunk[]> {
    const { input, nRetrieve, filterDirectory, config } = this.options;

    let retrievalResults: Chunk[] = [];

    let ftsChunks: Chunk[] = [];
    try {
      ftsChunks = await this.retrieveFts(args, nRetrieve);
    } catch (error) {
      await Telemetry.captureError("reranker_fts_retrieval", error);
      // console.error("Error retrieving FTS chunks:", error);
    }

    let embeddingsChunks: Chunk[] = [];
    try {
      embeddingsChunks = Boolean(config.selectedModelByRole.embed)
        ? await this.retrieveEmbeddings(input, nRetrieve)
        : [];
    } catch (error) {
      await Telemetry.captureError("reranker_embeddings_retrieval", error);
      console.error("Error retrieving embeddings chunks:", error);
    }

    let recentlyEditedFilesChunks: Chunk[] = [];
    try {
      recentlyEditedFilesChunks =
        await this.retrieveAndChunkRecentlyEditedFiles(nRetrieve);
    } catch (error) {
      await Telemetry.captureError("reranker_recently_edited_retrieval", error);
      console.error("Error retrieving recently edited files chunks:", error);
    }

    let repoMapChunks: Chunk[] = [];
    try {
      repoMapChunks = await requestFilesFromRepoMap(
        this.options.llm,
        this.options.config,
        this.options.ide,
        input,
        filterDirectory,
      );
    } catch (error) {
      await Telemetry.captureError("reranker_repo_map_retrieval", error);
      console.error("Error retrieving repo map chunks:", error);
    }

    if (config.experimental?.codebaseToolCallingOnly) {
      let toolBasedChunks: Chunk[] = [];
      try {
        toolBasedChunks = await this.retrieveWithTools(input);
      } catch (error) {
        console.error("Error retrieving tool based chunks:", error);
      }
      retrievalResults.push(...toolBasedChunks);
    } else {
      retrievalResults.push(
        ...recentlyEditedFilesChunks,
        ...ftsChunks,
        ...embeddingsChunks,
        ...repoMapChunks,
      );
    }

    if (filterDirectory) {
      // Backup if the individual retrieval methods don't listen
      retrievalResults = retrievalResults.filter(
        (chunk) =>
          !!findUriInDirs(chunk.filepath, [filterDirectory]).foundInDir,
      );
    }

    const deduplicatedRetrievalResults: Chunk[] =
      deduplicateChunks(retrievalResults);

    return deduplicatedRetrievalResults;
  }

  private async _rerank(input: string, chunks: Chunk[]): Promise<Chunk[]> {
    if (!this.options.config.selectedModelByRole.rerank) {
      throw new Error("No reranker set up");
    }

    // remove empty chunks -- some APIs fail on that
    chunks = chunks.filter((chunk) => chunk.content);

    try {
      let scores: number[] =
        await this.options.config.selectedModelByRole.rerank.rerank(
          input,
          chunks,
        );

      let results = chunks;

      const chunkIndexMap = new Map<Chunk, number>();
      chunks.forEach((chunk, idx) => chunkIndexMap.set(chunk, idx));

      results?.sort(
        (a, b) => scores[chunkIndexMap.get(b)!] - scores[chunkIndexMap.get(a)!],
      );
      results = results.slice(0, this.options.nFinal);
      return results;
    } catch (e) {
      console.warn(`Failed to rerank retrieval results\n${e}`);
      return chunks.slice(0, this.options.nFinal);
    }
  }

  async run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    let results = await this._retrieveInitial(args);
    results = await this._rerank(args.query, results);
    return results;
  }
}
