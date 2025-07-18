import { RangeInFile } from "..";
import { cosineSimilarity } from "../context/retrieval/pipelines/NextEditRetrievalPipeline";

export enum EditableRegionStrategy {
  Naive = "naive",
  Model = "model",
  Sliding = "sliding",
}

export function getNextEditableRegion(
  strategy: EditableRegionStrategy,
  ctx: any,
): RangeInFile | null {
  switch (strategy) {
    case EditableRegionStrategy.Naive:
      return naiveJump(ctx);
    case EditableRegionStrategy.Model:
      return modelJump(ctx);
    case EditableRegionStrategy.Sliding:
      return slidingJump(ctx);
    default:
      return null;
  }
}

// Naive assumes that the entire file is editable.
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

// A naive jump uses the next edit model to predict edits for the entire file.
// Then it calculates the diff between that and the original to get the jump location.
function modelJump(ctx: any): RangeInFile | null {
  try {
    const { fileContent, predictedContent, filepath } = ctx;

    if (!fileContent || !predictedContent || !filepath) {
      console.warn("Missing required context for model jump");
      return null;
    }

    const originalLines = fileContent.split("\n");
    const predictedLines = predictedContent.split("\n");

    // Find the first line that differs.
    for (
      let i = 0;
      i < Math.min(originalLines.length, predictedLines.length);
      i++
    ) {
      if (originalLines[i] !== predictedLines[i]) {
        // Calculate the end of the differing section (find where they align again).
        let endLine = i;
        while (
          endLine < Math.min(originalLines.length, predictedLines.length) &&
          originalLines[endLine] !== predictedLines[endLine]
        ) {
          endLine++;
        }

        // Return a range that covers the differences.
        return {
          filepath,
          range: {
            start: { line: i, character: 0 },
            end: {
              line: Math.min(endLine, originalLines.length - 1),
              character:
                originalLines[Math.min(endLine, originalLines.length - 1)]
                  .length,
            },
          },
        };
      }
    }

    // If no difference found but files have different lengths,
    if (originalLines.length !== predictedLines.length) {
      const diffStartLine = Math.min(
        originalLines.length,
        predictedLines.length,
      );
      return {
        filepath,
        range: {
          start: { line: diffStartLine, character: 0 },
          end: {
            line: originalLines.length - 1,
            character: originalLines.at(-1).length,
          },
        },
      };
    }

    // No differences found.
    return null;
  } catch (error) {
    console.error("Error in model jump:", error);
    return null;
  }
}

// A sliding jump uses a sliding window to split the current file into zones.
// Then each zone is ranked on how similar it is to the model's next edit prediction.
function slidingJump(ctx: any): RangeInFile | null {
  try {
    const { fileContent, predictedContent, filepath, windowSize = 5 } = ctx;

    if (!fileContent || !predictedContent || !filepath) {
      console.warn("Missing required context for sliding jump");
      return null;
    }

    const originalLines = fileContent.split("\n");
    const predictedLines = predictedContent.split("\n");

    // Create sliding windows/zones from the file.
    const zones: Array<{
      startLine: number;
      endLine: number;
      similarity: number;
    }> = [];

    for (
      let i = 0;
      i <= originalLines.length - windowSize;
      i += Math.floor(windowSize / 2)
    ) {
      const originalWindow = originalLines.slice(i, i + windowSize).join("\n");

      // For each zone, find the most similar section in the predicted content.
      let highestSimilarity = 0;

      for (
        let j = 0;
        j <= predictedLines.length - windowSize;
        j += Math.floor(windowSize / 2)
      ) {
        const predictedWindow = predictedLines
          .slice(j, j + windowSize)
          .join("\n");

        // Convert to simple vector representation for similarity calculation.
        const originalVector = createSimpleVector(originalWindow);
        const predictedVector = createSimpleVector(predictedWindow);

        const similarity = cosineSimilarity(originalVector, predictedVector);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
        }
      }

      zones.push({
        startLine: i,
        endLine: Math.min(i + windowSize - 1, originalLines.length - 1),
        similarity: highestSimilarity,
      });
    }

    // Find the zone with the highest similarity score.
    const mostSimilarZone = zones.reduce((prev, current) =>
      prev.similarity > current.similarity ? prev : current,
    );

    // Return the range of the most similar zone.
    return {
      filepath,
      range: {
        start: { line: mostSimilarZone.startLine, character: 0 },
        end: {
          line: mostSimilarZone.endLine,
          character: originalLines[mostSimilarZone.endLine].length,
        },
      },
    };
  } catch (error) {
    console.error("Error in sliding jump:", error);
    return null;
  }
}

// A rerank jump splits the current file into chunks.
// Then it uses a rerank model to get the most relevant chunks and their positions.
function rerankJump(ctx: any): RangeInFile | null {
  try {
    const { fileContent, query, filepath, reranker, chunkSize = 10 } = ctx;

    if (!fileContent || !query || !filepath || !reranker) {
      console.warn("Missing required context for rerank jump");
      return null;
    }

    const lines = fileContent.split("\n");
    const chunks: Array<{
      content: string;
      startLine: number;
      endLine: number;
    }> = [];

    // Create chunks from the file
    for (let i = 0; i < lines.length; i += Math.floor(chunkSize / 2)) {
      const endLine = Math.min(i + chunkSize - 1, lines.length - 1);
      const chunkContent = lines.slice(i, endLine + 1).join("\n");
      chunks.push({
        content: chunkContent,
        startLine: i,
        endLine: endLine,
      });
    }

    // Use the reranker to score each chunk against the query
    const scoredChunks = chunks.map((chunk) => ({
      ...chunk,
      score: reranker.rerank(query, [{ content: chunk.content }])[0],
    }));

    // Sort by score in descending order and get the highest scoring chunk
    const mostRelevantChunk = scoredChunks.sort((a, b) => b.score - a.score)[0];

    if (!mostRelevantChunk) {
      return null;
    }

    // Return the range of the most relevant chunk
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

// Helper method to create a simple vector representation of a text string.
function createSimpleVector(text: string): number[] {
  const tokenFrequency: Record<string, number> = {};

  // Split text into tokens.
  const tokens = text
    .toLowerCase()
    .split(/[\s.,\/#!$%\^&\*;:{}=\-_`~()\[\]]/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Count frequency of each token.
  for (const token of tokens) {
    tokenFrequency[token] = (tokenFrequency[token] || 0) + 1;
  }

  // Create a fixed-dimension vector (using common programming keywords as dimensions).
  const dimensions = [
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "const",
    "let",
    "var",
    "class",
    "import",
    "export",
    "interface",
    "type",
    "new",
    "this",
    "try",
    "catch",
    "async",
    "await",
    "true",
    "false",
    "null",
    "undefined",
  ];

  return dimensions.map((dim) => tokenFrequency[dim] || 0);
}
