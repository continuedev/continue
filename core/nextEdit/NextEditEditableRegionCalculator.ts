import { Chunk, ILLM, RangeInFile } from "..";

export enum EditableRegionStrategy {
  Naive = "naive",
  Rerank = "rerank",
}

export async function getNextEditableRegion(
  strategy: EditableRegionStrategy,
  ctx: any,
): Promise<RangeInFile | null> {
  switch (strategy) {
    case EditableRegionStrategy.Naive:
      return naiveJump(ctx);
    case EditableRegionStrategy.Rerank:
      return await rerankJump(ctx);
    default:
      return null;
  }
}

// Naive assumes that the entire file is editable.
// This relies on the next edit model to figure out where to jump next.
function naiveJump(ctx: any): RangeInFile | null {
  const { fileLines, filepath } = ctx;
  if (!fileLines || !filepath) {
    console.warn("Missing required context for naive jump");
    return null;
  }

  return {
    filepath,
    range: {
      start: { line: 0, character: 0 },
      end: {
        line: fileLines.length - 1,
        character: fileLines.at(-1).length,
      },
    },
  };
}

// A rerank jump splits the current file into chunks.
// Then it uses a rerank model to get the most relevant chunks and their positions.
async function rerankJump(ctx: {
  fileContent: string;
  query: string;
  filepath: string;
  reranker: ILLM;
  chunkSize: number;
}): Promise<RangeInFile | null> {
  try {
    const { fileContent, query, filepath, reranker, chunkSize = 5 } = ctx;

    if (!fileContent || !query || !filepath || !reranker) {
      console.warn(
        "Missing required context for rerank jump:",
        !fileContent,
        !query,
        !filepath,
        !reranker,
      );
      return null;
    }

    const lines = fileContent.split("\n");
    const chunks: Chunk[] = [];

    // Create chunks from the file.
    for (let i = 0; i < lines.length; i += Math.floor(chunkSize / 2)) {
      const endLine = Math.min(i + chunkSize - 1, lines.length - 1);
      const chunkContent = lines.slice(i, endLine + 1).join("\n");
      if (chunkContent === "") continue; // Voyager throws an error if there are empty strings in its document field in the body.
      chunks.push({
        content: chunkContent,
        startLine: i,
        endLine: endLine,
        digest: `chunk-${i}-${endLine}`,
        filepath: filepath,
        index: i,
      });
    }

    // Use the reranker to score each chunk against the query.
    const scores = await reranker.rerank(query, chunks);

    // Sort by score in descending order and get the highest scoring chunk.
    chunks.sort(
      (a, b) => scores[chunks.indexOf(b)] - scores[chunks.indexOf(a)],
    );

    // const mostRelevantChunk = chunks[0];
    // Get the third most relevant chunk if there are enough chunks,
    // otherwise fallback to second or first.
    // The most relevant chunk seems to be the one that
    // is similar enough lexically,
    // but different enough to still justify making an edit.
    const chunkIndex = Math.min(2, chunks.length - 1);
    const mostRelevantChunk = chunks[chunkIndex];

    // Return the range of the most relevant chunk.
    // NOTE: It might be better to return a list of chunks,
    // because it's very difficult to gauge when to stop the model.
    // We could argue that we should always try to jump until the user says no.
    return {
      filepath,
      range: {
        start: { line: mostRelevantChunk.startLine, character: 0 },
        end: {
          line: mostRelevantChunk.endLine,
          character: lines[mostRelevantChunk.endLine].length,
        },
      },
    };
  } catch (error) {
    console.error("Error in rerank jump:", error);
    return null;
  }
}
