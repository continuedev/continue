import { Chunk } from "../../../";
import { findUriInDirs } from "../../../util/uri";
import { requestFilesFromRepoMap } from "../repoMapRequest";
import { deduplicateChunks } from "../util";

import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "./BaseRetrievalPipeline";

export default class NoRerankerRetrievalPipeline extends BaseRetrievalPipeline {
  async run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    const { input, nFinal, filterDirectory, config } = this.options;

    // We give 1/4 weight to recently edited files, 1/4 to full text search,
    // and the remaining 1/2 to embeddings
    const recentlyEditedNFinal = nFinal * 0.25;
    const ftsNFinal = nFinal * 0.25;
    const embeddingsNFinal = nFinal - recentlyEditedNFinal - ftsNFinal;

    let retrievalResults: Chunk[] = [];

    let ftsChunks: Chunk[] = [];
    try {
      ftsChunks = await this.retrieveFts(args, ftsNFinal);
    } catch (error) {
      console.error("Error retrieving FTS chunks:", error);
    }

    let embeddingsChunks: Chunk[] = [];
    try {
      embeddingsChunks = !!config.selectedModelByRole.embed
        ? await this.retrieveEmbeddings(input, embeddingsNFinal)
        : [];
    } catch (error) {
      console.error("Error retrieving embeddings:", error);
    }

    let recentlyEditedFilesChunks: Chunk[] = [];
    try {
      recentlyEditedFilesChunks =
        await this.retrieveAndChunkRecentlyEditedFiles(recentlyEditedNFinal);
    } catch (error) {
      console.error("Error retrieving recently edited files:", error);
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
}
