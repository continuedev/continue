import { Chunk, ChunkWithoutID } from "../../index.js";
import { countTokensAsync } from "../../llm/countTokens.js";
import { supportedLanguages } from "../../util/treeSitter.js";
import { getUriFileExtension, getUriPathBasename } from "../../util/uri.js";

import { basicChunker } from "./basic.js";
import { codeChunker } from "./code.js";

export type ChunkDocumentParam = {
  filepath: string;
  contents: string;
  maxChunkSize: number;
  digest: string;
};

export async function* chunkDocumentWithoutId(
  fileUri: string,
  contents: string,
  maxChunkSize: number,
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim() === "") {
    return;
  }
  const extension = getUriFileExtension(fileUri);
  // Files that should use basicChunker despite having tree-sitter support
  // These files don't have code structure (classes/functions) that codeChunker expects
  const NON_CODE_EXTENSIONS = [
    "css",
    "html",
    "htm",
    "json",
    "toml",
    "yaml",
    "yml",
  ];

  if (
    extension in supportedLanguages &&
    !NON_CODE_EXTENSIONS.includes(extension)
  ) {
    try {
      for await (const chunk of codeChunker(fileUri, contents, maxChunkSize)) {
        yield chunk;
      }
      return;
    } catch (e: any) {
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
      new Promise((resolve) => {
        void (async () => {
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
            index: index++,
            filepath,
          });
        })();
      }),
    );
  }
  for await (const chunk of chunkPromises) {
    if (!chunk) {
      continue;
    }
    yield chunk;
  }
}

export function shouldChunk(fileUri: string, contents: string): boolean {
  if (contents.length > 1000000) {
    // if a file has more than 1m characters then skip it
    return false;
  }
  if (contents.length === 0) {
    return false;
  }
  const baseName = getUriPathBasename(fileUri);
  return baseName.includes(".");
}
