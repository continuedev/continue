import {
  BranchAndDir,
  Chunk,
  ContinueConfig,
  IDE,
  ILLM,
  Position,
} from "../../..";
import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "./BaseRetrievalPipeline";

export default class NextEditRetrievalPipeline extends BaseRetrievalPipeline {
  async run(args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    if (args.includeEmbeddings) {
      await this.ensureLanceDbInitialized();
    }

    // Try each retrieval method.
    // Embeddings can fail if query.execute() goes wrong.
    const embeddingPromise = async () => {
      if (!args.includeEmbeddings) return [];
      try {
        return await this.retrieveEmbeddings(
          args.query,
          this.options.nRetrieve,
        );
      } catch (error) {
        console.error("Error retrieving embeddings:", error);
        return [];
      }
    };

    const ftsPromise = async () => {
      try {
        return await this.retrieveFts(args, this.options.nRetrieve);
      } catch (error) {
        console.error("Error retrieving from full-text search:", error);
        return [];
      }
    };

    const recentFilesPromise = async () => {
      try {
        return await this.retrieveAndChunkRecentlyEditedFiles(
          this.options.nRetrieve,
        );
      } catch (error) {
        console.error("Error retrieving recently edited files:", error);
        return [];
      }
    };

    const toolsPromise = async () => {
      try {
        return await this.retrieveWithTools(args.query);
      } catch (error) {
        console.error("Error retrieving with tools:", error);
        return [];
      }
    };

    const [embeddingChunks, ftsChunks, recentChunks, toolChunks] =
      await Promise.all([
        embeddingPromise(),
        ftsPromise(),
        recentFilesPromise(),
        toolsPromise(),
      ]);

    //   console.log(`Retrieved chunks: ${embeddingChunks.length} from embeddings, ${ftsChunks.length} from FTS, ${recentChunks.length} from recent
    // files, ${toolChunks.length} from tools`);

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
    if (
      uniqueChunks.length > this.options.nFinal &&
      embeddingChunks.length > 0
    ) {
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
  try {
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
      includeEmbeddings: !options.config.experimental?.codebaseToolCallingOnly,
    });

    return chunks;
  } catch (error) {
    console.error("Error getting relevant code chunks:", error);
    return [];
  }
}

export async function retrieveRelevantSnippetsInFile(
  query: string,
  filepath: string,
  cursorPosition: Position,
  maxSnippets: number = 5,
  snippetSize: number = 10, // lines per snippet
  ide: IDE,
): Promise<Chunk[]> {
  try {
    const fileContent = await ide.readFile(filepath);
    const lines = fileContent.split("\n");

    // Create smaller overlapping chunks around the cursor position.
    const chunks: Chunk[] = [];
    const totalLines = lines.length;

    // If file is too small, skip chunking.
    // Ideally we want to keep the chunk size smaller for jump purposes.
    if (totalLines <= snippetSize * 2) {
      return [];
    }

    // Use sliding window to create chunks in the file.
    // Make sure to overlap the window while sliding.
    for (
      let startLine = 0;
      startLine < totalLines - snippetSize;
      startLine += Math.floor(snippetSize / 2)
    ) {
      // Skip the chunk that contains the cursor.
      // NOTE: We might just include it.
      if (
        startLine <= cursorPosition.line &&
        cursorPosition.line < startLine + snippetSize
      ) {
        continue;
      }

      const endLine = Math.min(startLine + snippetSize - 1, totalLines - 1);
      const content = lines.slice(startLine, endLine + 1).join("\n");

      chunks.push({
        content,
        startLine,
        endLine,
        digest: `${filepath}:${startLine}-${endLine}`,
        filepath,
        index: chunks.length,
      });
    }

    // Calculate relevance score for each chunk.
    // For now, we use simple keyword matching
    // In the future we should use embeddings or cosine similarity.
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 2);

    const scoredChunks = chunks.map((chunk) => {
      const lowerContent = chunk.content.toLowerCase();
      const score = keywords.reduce((sum, keyword) => {
        return sum + (lowerContent.includes(keyword) ? 1 : 0);
      }, 0);

      return { chunk, score };
    });

    // Sort by score desc.
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSnippets)
      .map((sc) => sc.chunk);
  } catch (error) {
    console.error("Error finding relevant in-file snippets:", error);
    return [];
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// export async function getJumpDestinations(
//   codeSnippet: string,
//   cursorPosition: Position,
//   filepath: string,
// ): Promise<Chunk[]> {
// }
