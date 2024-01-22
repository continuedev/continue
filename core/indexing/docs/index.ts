import {
  Chunk,
  ChunkWithoutID,
  EmbeddingsProvider,
  IndexingProgressUpdate,
} from "../..";
import { MAX_CHUNK_SIZE } from "../../llm/constants";
import { markdownChunker } from "../chunk/markdown";
import { crawlSubpages } from "./crawl";
import { addDocs, listDocs } from "./db";
import { convertURLToMarkdown } from "./urlToMarkdown";

export async function* indexDocs(
  title: string,
  baseUrl: URL,
  embeddingsProvider: EmbeddingsProvider
): AsyncGenerator<IndexingProgressUpdate> {
  const existingDocs = await listDocs();
  if (existingDocs.find((doc) => doc.title === title)) {
    yield {
      progress: 1,
      desc: "Already indexed",
    };
    return;
  }

  yield {
    progress: 0,
    desc: "Finding subpages",
  };

  let subpaths = await crawlSubpages(baseUrl);
  console.log("Found subpaths", subpaths);
  const chunks: Chunk[] = [];
  const embeddings: number[][] = [];

  let markdownForSubpaths = await Promise.all(
    subpaths.map((subpath) => convertURLToMarkdown(new URL(subpath, baseUrl)))
  );

  // Filter out undefineds
  let filteredSubpaths: string[] = [];
  let filteredMarkdown: string[] = [];
  for (let i = 0; i < subpaths.length; i++) {
    if (markdownForSubpaths[i]) {
      filteredSubpaths.push(subpaths[i]);
      filteredMarkdown.push(markdownForSubpaths[i]!);
    }
  }
  subpaths = filteredSubpaths;
  markdownForSubpaths = filteredMarkdown;

  for (let i = 0; i < subpaths.length; i++) {
    const subpath = subpaths[i];
    yield {
      progress: 100 / (subpaths.length + 1),
      desc: `${subpath}`,
    };

    const markdown = markdownForSubpaths[i]!;
    const markdownChunks: ChunkWithoutID[] = [];
    for await (const chunk of markdownChunker(markdown, MAX_CHUNK_SIZE, 0)) {
      markdownChunks.push(chunk);
    }

    const subpathEmbeddings = await embeddingsProvider.embed(
      markdownChunks.map((chunk) => chunk.content)
    );

    markdownChunks.forEach((chunk, index) => {
      chunks.push({
        ...chunk,
        filepath:
          subpath +
          (chunk.otherMetadata?.fragment
            ? `#${chunk.otherMetadata.fragment}`
            : ""),
        index,
        digest: subpath,
      });
    });
    embeddings.push(...subpathEmbeddings);
  }

  await addDocs(title, baseUrl, chunks, embeddings);

  yield {
    progress: 1,
    desc: "Done",
  };
}
