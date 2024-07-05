import { Chunk } from "../../..";
import { RETRIEVAL_PARAMS } from "../../../util/parameters";
import { deduplicateChunks } from "../util";
import BaseRetrievalPipeline from "./BaseRetrievalPipeline";

export default class RerankerRetrievalPipeline extends BaseRetrievalPipeline {
  private async _retrieveInitial(): Promise<Chunk[]> {
    const { input } = this.options;

    // Get all retrieval results
    const retrievalResults: Chunk[] = [];

    // Full-text search
    const ftsResults = await this.retrieveFts(
      input,
      this.options.nRetrieve / 2,
    );
    retrievalResults.push(...ftsResults);

    // Embeddings
    const embeddingResults = await this.retrieveEmbeddings(
      input,
      this.options.nRetrieve / 2,
    );
    retrievalResults.push(...embeddingResults);

    const results: Chunk[] = deduplicateChunks(retrievalResults);
    return results;
  }

  async run(): Promise<Chunk[]> {
    // Retrieve initial results
    let results = await this._retrieveInitial();

    // Re-rank
    const { reranker, input, nFinal } = this.options;
    if (!reranker) {
      console.warn("No reranker provided, returning results as is");
      return results;
    }

    let scores: number[] = await reranker.rerank(input, results);

    // Filter out low-scoring results
    results = results.filter(
      (_, i) => scores[i] >= RETRIEVAL_PARAMS.rerankThreshold,
    );
    scores = scores.filter(
      (score) => score >= RETRIEVAL_PARAMS.rerankThreshold,
    );

    results.sort(
      (a, b) => scores[results.indexOf(a)] - scores[results.indexOf(b)],
    );
    results = results.slice(-nFinal);

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
