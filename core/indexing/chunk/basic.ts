import { ChunkWithoutID } from "../../index.js";
import { countTokensAsync } from "../../llm/countTokens.js";

/**
 * Basic chunker that splits text content into chunks based on token size.
 *
 * Features:
 * - Creates chunks up to maxChunkSize tokens in length
 * - Preserves line breaks
 * - Handles lines that exceed maxChunkSize
 * - Properly tracks line numbers for each chunk
 *
 * @param contents The text content to chunk
 * @param maxChunkSize Maximum number of tokens per chunk
 * @returns AsyncGenerator yielding chunks without IDs
 */
export async function* basicChunker(
  contents: string,
  maxChunkSize: number,
): AsyncGenerator<ChunkWithoutID> {
  // Don't generate chunks for empty content
  if (contents.trim().length === 0) {
    return;
  }

  // Split the content into lines
  const lines = contents.split("\n");
  // Handle the case where content ends with newline (creates an empty last element)
  if (lines[lines.length - 1] === "" && contents.endsWith("\n")) {
    lines.pop();
  }

  // Initialize chunking state
  let chunkContent = "";
  let chunkTokens = 0;
  let startLine = 0;
  let currLine = 0;

  // Calculate token counts for each line
  const lineTokens: { line: string; tokenCount: number }[] = [];
  for (const line of lines) {
    lineTokens.push({
      line,
      tokenCount: await countTokensAsync(line),
    });
  }

  // Process lines into chunks
  for (let i = 0; i < lineTokens.length; i++) {
    const { line, tokenCount } = lineTokens[i];
    const newlineTokenCost = 1; // Cost of adding a newline

    // If adding this line would exceed our chunk size and we already have content,
    // yield the current chunk first
    if (
      chunkTokens > 0 &&
      chunkTokens + tokenCount + newlineTokenCost > maxChunkSize
    ) {
      yield {
        content: chunkContent,
        startLine,
        endLine: currLine - 1,
      };
      chunkContent = "";
      chunkTokens = 0;
      startLine = i;
    }

    // Add the current line to our chunk
    chunkContent += line + "\n";
    chunkTokens += tokenCount + newlineTokenCost;
    currLine = i + 1;

    // If this line alone exceeds the max size, create a chunk just for this line
    // But only if this is the only line in the current chunk
    if (tokenCount > maxChunkSize && i === startLine) {
      yield {
        content: chunkContent,
        startLine: i,
        endLine: i,
      };
      chunkContent = "";
      chunkTokens = 0;
      startLine = i + 1;
      currLine = i + 1;
    }
  }

  // Yield any remaining content
  if (chunkContent.length > 0) {
    yield {
      content: chunkContent,
      startLine,
      endLine: currLine - 1,
    };
  }
}
