import { Chunk } from "../../../index.js";
import { requestFilesFromRepoMap } from "../repoMapRequest.js";
import { deduplicateChunks } from "../util.js";
import BaseRetrievalPipeline from "./BaseRetrievalPipeline.js";

export default class NoRerankerRetrievalPipeline extends BaseRetrievalPipeline {
  async run(): Promise<Chunk[]> {
    const { input, nFinal, filterDirectory } = this.options;

    // We give 1/4 weight to recently edited files, 1/4 to full text search,
    // and the remaining 1/2 to embeddings
    const recentlyEditedNFinal = nFinal * 0.25;
    const ftsNFinal = nFinal * 0.25;
    const embeddingsNFinal = nFinal - recentlyEditedNFinal - ftsNFinal;

    let retrievalResults: Chunk[] = [];

    const ftsChunks = await this.retrieveFts(input, ftsNFinal);

    const embeddingsChunks = await this.retrieveEmbeddings(
      input,
      embeddingsNFinal,
    );

    const recentlyEditedFilesChunks =
      await this.retrieveAndChunkRecentlyEditedFiles(recentlyEditedNFinal);

    const repoMapChunks = await requestFilesFromRepoMap(
      this.options.llm,
      this.options.config,
      this.options.ide,
      input,
      filterDirectory,
    );

    retrievalResults.push(
      ...recentlyEditedFilesChunks,
      ...ftsChunks,
      ...embeddingsChunks,
      ...repoMapChunks,
    );

    if (filterDirectory) {
      // Backup if the individual retrieval methods don't listen
      retrievalResults = retrievalResults.filter((chunk) =>
        chunk.filepath.startsWith(filterDirectory),
      );
    }

    const deduplicatedRetrievalResults: Chunk[] =
      deduplicateChunks(retrievalResults);

    return deduplicatedRetrievalResults;
  }
}
