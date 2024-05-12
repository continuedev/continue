import { ChunkWithoutID } from "../../index.js";
import { countTokens } from "../../llm/countTokens.js";

export function* basicChunker(
  contents: string,
  maxChunkSize: number,
): Generator<ChunkWithoutID> {
  let chunkContent = "";
  let chunkTokens = 0;
  let startLine = 0;
  let currLine = 0;

  for (const line of contents.split("\n")) {
    const lineTokens = countTokens(line);
    if (chunkTokens + lineTokens > maxChunkSize - 5) {
      yield { content: chunkContent, startLine, endLine: currLine - 1 };
      chunkContent = "";
      chunkTokens = 0;
      startLine = currLine;
    }

    if (lineTokens < maxChunkSize) {
      chunkContent += `${line}\n`;
      chunkTokens += lineTokens + 1;
    }

    currLine++;
  }

  yield {
    content: chunkContent,
    startLine,
    endLine: currLine - 1,
  };
}
