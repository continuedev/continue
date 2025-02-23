import { Chunk } from "../../../";
import { findUriInDirs } from "../../../util/uri";
import { requestFilesFromRepoMap } from "../repoMapRequest";
import { deduplicateChunks } from "../util";

import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "./BaseRetrievalPipeline";

export default class NoRerankerRetrievalPipeline extends BaseRetrievalPipeline {
  async run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    const { input, nFinal, filterDirectory, includeEmbeddings } = this.options;

    // We give 1/4 weight to recently edited files, 1/4 to full text search,
    // and the remaining 1/2 to embeddings
    const recentlyEditedNFinal = nFinal * 0.25;
    const ftsNFinal = nFinal * 0.25;
    const embeddingsNFinal = nFinal - recentlyEditedNFinal - ftsNFinal;

    let retrievalResults: Chunk[] = [];

    const ftsChunks = await this.retrieveFts(args, ftsNFinal);

    const embeddingsChunks = includeEmbeddings
      ? await this.retrieveEmbeddings(input, embeddingsNFinal)
      : [];

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
