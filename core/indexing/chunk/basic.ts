import { ChunkWithoutID } from "../../index.js";
import { countTokensAsync } from "../../llm/countTokens.js";

export async function* basicChunker(
  contents: string,
  maxChunkSize: number,
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim().length === 0) {
    return;
  }

  let chunkContent = "";
  let chunkTokens = 0;
  let startLine = 0;
  let currLine = 0;

  const lineTokens = await Promise.all(
    contents.split("\n").map(async (l) => {
      return {
        line: l,
        tokenCount: await countTokensAsync(l),
      };
    }),
  );

  for (const lt of lineTokens) {
    if (chunkTokens + lt.tokenCount > maxChunkSize - 5) {
      yield { content: chunkContent, startLine, endLine: currLine - 1 };
      chunkContent = "";
      chunkTokens = 0;
      startLine = currLine;
    }

    if (lt.tokenCount < maxChunkSize) {
      chunkContent += `${lt.line}\n`;
      chunkTokens += lt.tokenCount + 1;
    }

    currLine++;
  }

  yield {
    content: chunkContent,
    startLine,
    endLine: currLine - 1,
  };
}
