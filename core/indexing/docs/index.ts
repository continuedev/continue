import {
  Chunk,
  EmbeddingsProvider,
  IndexingProgressUpdate,
} from "../..";

import { crawlSubpages } from "./crawl";
import { addDocs, listDocs } from "./db";
import { urlToArticle, chunkArticle } from "./article";

export async function* indexDocs(
  title: string,
  baseUrl: URL,
  embeddingsProvider: EmbeddingsProvider,
): AsyncGenerator<IndexingProgressUpdate> {
  const existingDocs = await listDocs();
  if (existingDocs.find((doc) => doc.baseUrl === baseUrl.toString())) {
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

  const subpathGenerator = crawlSubpages(baseUrl);
  let { value, done } = await subpathGenerator.next();
  
  while (true) {
    if (done) {
      break;
    }
    yield {
      progress: 0,
      desc: `Finding subpages (${value})`,
    };
    const next = await subpathGenerator.next();
    value = next.value;
    done = next.done;
  }

  let subpaths = value as string[];

  const chunks: Chunk[] = [];
  const embeddings: number[][] = [];

  let articles = await Promise.all(
    subpaths.map(subpath => urlToArticle(subpath, baseUrl)),
  );

  for (const article of articles) {
    if (!article) continue; 

    yield {
      progress: Math.max(1, Math.floor(100 / (subpaths.length + 1))),
      desc: `${article.subpath}`,
    };

    const subpathEmbeddings = await embeddingsProvider.embed(
      chunkArticle(article).map(chunk => {
        chunks.push(chunk);

        return chunk.content;
      })
    );

    embeddings.push(...subpathEmbeddings);
  }

  await addDocs(title, baseUrl, chunks, embeddings);

  yield {
    progress: 1,
    desc: "Done",
  };
}
