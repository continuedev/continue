import { Chunk, ChunkWithoutID } from "../../index.js";
import { countTokensAsync } from "../../llm/countTokens.js";
import { extractMinimalStackTraceInfo } from "../../util/extractMinimalStackTraceInfo.js";
import { Telemetry } from "../../util/posthog.js";
import { supportedLanguages } from "../../util/treeSitter.js";

import { basicChunker } from "./basic.js";
import { codeChunker } from "./code.js";

export type ChunkDocumentParam = {
  filepath: string;
  contents: string;
  maxChunkSize: number;
  digest: string;
};

async function* chunkDocumentWithoutId(
  filepath: string,
  contents: string,
  maxChunkSize: number,
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim() === "") {
    return;
  }

  const segs = filepath.split(".");
  const ext = segs[segs.length - 1];
  if (ext in supportedLanguages) {
    try {
      for await (const chunk of codeChunker(filepath, contents, maxChunkSize)) {
        yield chunk;
      }
      return;
    } catch (e: any) {
      Telemetry.capture("code_chunker_error", {
        fileExtension: ext,
        stack: extractMinimalStackTraceInfo(e.stack),
      });
      // falls back to basicChunker
    }
  }

  yield* basicChunker(contents, maxChunkSize);
}

export async function* chunkDocument({
  filepath,
  contents,
  maxChunkSize,
  digest,
}: ChunkDocumentParam): AsyncGenerator<Chunk> {
  let index = 0;
  const chunkPromises: Promise<Chunk | undefined>[] = [];
  for await (const chunkWithoutId of chunkDocumentWithoutId(
    filepath,
    contents,
    maxChunkSize,
  )) {
    chunkPromises.push(
      new Promise(async (resolve) => {
        if ((await countTokensAsync(chunkWithoutId.content)) > maxChunkSize) {
          // console.debug(
          //   `Chunk with more than ${maxChunkSize} tokens constructed: `,
          //   filepath,
          //   countTokens(chunkWithoutId.content),
          // );
          return resolve(undefined);
        }
        resolve({
          ...chunkWithoutId,
          digest,
          index,
          filepath,
        });
      }),
    );
    index++;
  }
  for await (const chunk of chunkPromises) {
    if (!chunk) {
      continue;
    }
    yield chunk;
  }
}

export function shouldChunk(
  pathSep: string,
  filepath: string,
  contents: string,
): boolean {
  if (contents.length > 1000000) {
    // if a file has more than 1m characters then skip it
    return false;
  }
  if (contents.length === 0) {
    return false;
  }
  const basename = filepath.split(pathSep).pop();
  // files without extensions are often binary files, skip it if so
  return basename?.includes(".") ?? false;
}
