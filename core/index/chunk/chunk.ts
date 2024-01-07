import { Chunk, ChunkWithoutID } from ".";
import { basicChunker } from "./basic";
import { codeChunker, fileExtensionToLanguage } from "./code";

async function* chunkDocumentWithoutId(
  filepath: string,
  contents: string,
  maxChunkSize: number
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim() === "") {
    return;
  }

  const segs = filepath.split(".");
  const ext = segs[segs.length - 1];
  if (ext in fileExtensionToLanguage) {
    for await (const chunk of codeChunker(filepath, contents, maxChunkSize)) {
      yield chunk;
    }
    return;
  }

  yield* basicChunker(contents, maxChunkSize);
}

export async function* chunkDocument(
  filepath: string,
  contents: string,
  maxChunkSize: number,
  digest: string
): AsyncGenerator<Chunk> {
  let index = 0;
  for await (let chunkWithoutId of chunkDocumentWithoutId(
    filepath,
    contents,
    maxChunkSize
  )) {
    yield {
      ...chunkWithoutId,
      digest,
      index,
      filepath,
    };
    index++;
  }
}
