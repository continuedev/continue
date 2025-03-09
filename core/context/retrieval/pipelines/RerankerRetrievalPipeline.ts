import { Chunk } from "../../..";
import { RETRIEVAL_PARAMS } from "../../../util/parameters";
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
      console.error("Error retrieving FTS chunks:", error);
    }

    let embeddingsChunks: Chunk[] = [];
    try {
      embeddingsChunks = !!config.selectedModelByRole.embed
        ? await this.retrieveEmbeddings(input, nRetrieve)
        : [];
    } catch (error) {
      console.error("Error retrieving embeddings chunks:", error);
    }

    let recentlyEditedFilesChunks: Chunk[] = [];
    try {
      recentlyEditedFilesChunks =
        await this.retrieveAndChunkRecentlyEditedFiles(nRetrieve);
    } catch (error) {
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
      console.error("Error retrieving repo map chunks:", error);
    }

    retrievalResults.push(
      ...recentlyEditedFilesChunks,
      ...ftsChunks,
      ...embeddingsChunks,
      ...repoMapChunks,
    );

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

    let scores: number[] =
      await this.options.config.selectedModelByRole.rerank.rerank(
        input,
        chunks,
      );

    // Filter out low-scoring results
    let results = chunks;
    // let results = chunks.filter(
    //   (_, i) => scores[i] >= RETRIEVAL_PARAMS.rerankThreshold,
    // );
    // scores = scores.filter(
    //   (score) => score >= RETRIEVAL_PARAMS.rerankThreshold,
    // );

    const chunkIndexMap = new Map<Chunk, number>();
    chunks.forEach((chunk, idx) => chunkIndexMap.set(chunk, idx));

    results.sort(
      (a, b) => scores[chunkIndexMap.get(a)!] - scores[chunkIndexMap.get(b)!],
    );
    results = results.slice(-this.options.nFinal);
    return results;
  }

  private async _expandWithEmbeddings(chunks: Chunk[]): Promise<Chunk[]> {
    const topResults = chunks.slice(
      -RETRIEVAL_PARAMS.nResultsToExpandWithEmbeddings,
    );

    const expanded = await Promise.all(
      topResults.map(async (chunk, i) => {
        const results = await this.retrieveEmbeddings(
          chunk.content,
          RETRIEVAL_PARAMS.nEmbeddingsExpandTo,
        );
        return results;
      }),
    );
    return expanded.flat();
  }

  private async _expandRankedResults(chunks: Chunk[]): Promise<Chunk[]> {
    let results: Chunk[] = [];

    const embeddingsResults = await this._expandWithEmbeddings(chunks);
    results.push(...embeddingsResults);

    return results;
  }

  async run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    let results = await this._retrieveInitial(args);
    results = await this._rerank(args.query, results);

    // // // Expand top reranked results
    // const expanded = await this._expandRankedResults(results);
    // results.push(...expanded);

    // // De-duplicate
    // results = deduplicateChunks(results);

    // // Rerank again
    // results = await this._rerank(input, results);

    // TODO: stitch together results

    return results;
  }
}

// Source: expansion with code graph
// consider doing this after reranking? Or just having a lower reranking threshold
// This is VS Code only until we use PSI for JetBrains or build our own general solution
// TODO: Need to pass in the expandSnippet function as a function argument
// because this import causes `tsc` to fail
// if ((await extras.ide.getIdeInfo()).ideType === "vscode") {
//   const { expandSnippet } = await import(
//     "../../../extensions/vscode/src/util/expandSnippet"
//   );
//   let expansionResults = (
//     await Promise.all(
//       extras.selectedCode.map(async (rif) => {
//         return expandSnippet(
//           rif.filepath,
//           rif.range.start.line,
//           rif.range.end.line,
//           extras.ide,
//         );
//       }),
//     )
//   ).flat() as Chunk[];
//   retrievalResults.push(...expansionResults);
// }

// Source: Open file exact match
// Source: Class/function name exact match
