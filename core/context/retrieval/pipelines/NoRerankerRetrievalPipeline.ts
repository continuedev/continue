import { Chunk } from "../../../index.js";
import { deduplicateChunks } from "../util.js";
import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "./BaseRetrievalPipeline.js";

export default class NoRerankerRetrievalPipeline extends BaseRetrievalPipeline {
  async run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    // Get all retrieval results
    const retrievalResults: Chunk[] = [];

    // Full-text search
    const ftsResults = await this.retrieveFts(args, this.options.nFinal / 2);
    retrievalResults.push(...ftsResults);

    // Embeddings
    const embeddingResults = await this.retrieveEmbeddings(
      args,
      this.options.nFinal / 2,
    );
    retrievalResults.push(...embeddingResults);

    const finalResults: Chunk[] = deduplicateChunks(retrievalResults);
    return finalResults;
  }
}
