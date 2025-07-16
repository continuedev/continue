import { BranchAndDir, Chunk, ContinueConfig, IDE, ILLM } from "../../..";
import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "./BaseRetrievalPipeline";

export default class NextEditRetrievalPipeline extends BaseRetrievalPipeline {
  async run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    if (args.includeEmbeddings) {
      await this.ensureLanceDbInitialized();
    }
    // Collect chunks from multiple sources.
    const [embeddingChunks, ftsChunks, recentChunks, toolChunks] =
      await Promise.all([
        // Get chunks using embeddings similarity (vector search).
        args.includeEmbeddings
          ? this.retrieveEmbeddings(args.query, this.options.nRetrieve)
          : Promise.resolve([]),

        // Get chunks using full-text search.
        this.retrieveFts(args, this.options.nRetrieve),

        // Get chunks from recently edited files.
        this.retrieveAndChunkRecentlyEditedFiles(this.options.nRetrieve),

        // Get chunks using LLM-guided tool selection.
        this.retrieveWithTools(args.query),
      ]);

    // Combine all chunks.
    let allChunks = [
      ...embeddingChunks,
      ...ftsChunks,
      ...recentChunks,
      ...toolChunks,
    ];

    // Remove duplicates by digest.
    const uniqueDigests = new Set<string>();
    const uniqueChunks = allChunks.filter((chunk) => {
      if (uniqueDigests.has(chunk.digest)) {
        return false;
      }
      uniqueDigests.add(chunk.digest);
      return true;
    });

    // If we have too many chunks and embedding retrieval is available,
    // prioritize chunks from embedding search as they're likely more semantically relevant.
    if (uniqueChunks.length > this.options.nFinal) {
      // First include embedding chunks (most semantically relevant).
      const result: Chunk[] = [...embeddingChunks];

      // Then add unique chunks from other sources until we reach nFinal.
      const remainingChunks = uniqueChunks.filter(
        (chunk) => !embeddingChunks.some((ec) => ec.digest === chunk.digest),
      );

      result.push(
        ...remainingChunks.slice(0, this.options.nFinal - result.length),
      );

      return result.slice(0, this.options.nFinal);
    }

    // Otherwise just return the unique chunks up to nFinal.
    return uniqueChunks.slice(0, this.options.nFinal);
  }
}

export async function getTopRelevantCodeChunks(
  codeSnippet: string,
  options: {
    ide: IDE;
    llm: ILLM;
    config: ContinueConfig;
    tags: BranchAndDir[];
    filterDirectory?: string;
  },
): Promise<Chunk[]> {
  const retrievalPipeline = new NextEditRetrievalPipeline({
    llm: options.llm,
    config: options.config,
    ide: options.ide,
    input: codeSnippet,
    nRetrieve: 10, // retrieve more initially for better filtering
    nFinal: 5, // return top 5
    tags: options.tags,
    filterDirectory: options.filterDirectory,
  });

  const chunks = await retrievalPipeline.run({
    query: codeSnippet,
    tags: options.tags,
    filterDirectory: options.filterDirectory,
    includeEmbeddings: true,
  });

  return chunks;
}
