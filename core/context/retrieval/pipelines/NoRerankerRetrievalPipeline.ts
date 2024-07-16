import { Chunk } from "../../../index.js";
import { deduplicateChunks } from "../util.js";
import BaseRetrievalPipeline from "./BaseRetrievalPipeline.js";

export default class NoRerankerRetrievalPipeline extends BaseRetrievalPipeline {
  async run(): Promise<Chunk[]> {
    const { input } = this.options;

    // Get all retrieval results
    const retrievalResults: Chunk[] = [];

    // Full-text search
    const ftsResults = await this.retrieveFts(input, this.options.nFinal / 2);
    retrievalResults.push(...ftsResults);

    // Embeddings
    const embeddingResults = await this.retrieveEmbeddings(
      input,
      this.options.nFinal / 2,
    );
    retrievalResults.push(...embeddingResults);

    const finalResults: Chunk[] = deduplicateChunks(retrievalResults);
    return finalResults;
  }
}
