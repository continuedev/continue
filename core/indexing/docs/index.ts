import {
  Chunk,
  ChunkWithoutID,
  EmbeddingsProvider,
  IndexingProgressUpdate,
} from "../..";
import { MAX_CHUNK_SIZE } from "../../llm/constants";
import { markdownChunker } from "../chunk/markdown";
import { convertURLToMarkdown, crawlSubpages } from "./crawl";
import { addDocs } from "./db";

export async function* indexDocs(
  title: string,
  baseUrl: URL,
  embeddingsProvider: EmbeddingsProvider
): AsyncGenerator<IndexingProgressUpdate> {
  yield {
    progress: 0,
    desc: "Finding subpages...",
  };

  const subpaths = await crawlSubpages(baseUrl);
  const chunks: Chunk[] = [];
  const embeddings: number[][] = [];

  for (let i = 0; i < subpaths.length; i++) {
    const subpath = subpaths[i];
    yield {
      progress: (i + 1) / (subpaths.length + 1),
      desc: `Indexing ${subpath}...`,
    };

    const subpathUrl = new URL(subpath, baseUrl);

    const markdown = await convertURLToMarkdown(subpathUrl);
    const markdownChunks: ChunkWithoutID[] = [];
    for await (const chunk of markdownChunker(markdown, MAX_CHUNK_SIZE, 0)) {
      markdownChunks.push(chunk);
    }

    const embeddings = await embeddingsProvider.embed(
      markdownChunks.map((chunk) => chunk.content)
    );

    markdownChunks.forEach((chunk, index) => {
      chunks.push({
        ...chunk,
        filepath: subpath,
        index,
        digest: subpath,
      });
    });
    embeddings.push(...embeddings);
  }

  await addDocs(title, baseUrl, chunks, embeddings);

  yield {
    progress: 1,
    desc: "Done",
  };
}
