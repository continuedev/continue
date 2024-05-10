import { Chunk, EmbeddingsProvider, IndexingProgressUpdate } from "../..";

import { Article, chunkArticle, pageToArticle } from "./article";
import { crawlPage } from "./crawl";
import { addDocs, hasDoc } from "./db";

export async function* indexDocs(
  title: string,
  baseUrl: URL,
  embeddingsProvider: EmbeddingsProvider,
): AsyncGenerator<IndexingProgressUpdate> {
  if (await hasDoc(baseUrl.toString())) {
    yield {
      progress: 1,
      desc: "Already indexed",
      status: "done",
    };
    return;
  }

  yield {
    progress: 0,
    desc: "Finding subpages",
    status: "indexing",
  };

  const articles: Article[] = [];

  for await (const page of crawlPage(baseUrl)) {
    const article = pageToArticle(page);
    if (!article) continue;

    articles.push(article);

    yield {
      progress: 0,
      desc: `Finding subpages (${page.path})`,
      status: "indexing",
    };
  }

  const chunks: Chunk[] = [];
  const embeddings: number[][] = [];

  for (const article of articles) {
    yield {
      progress: Math.max(1, Math.floor(100 / (articles.length + 1))),
      desc: `${article.subpath}`,
      status: "indexing",
    };

    const subpathEmbeddings = await embeddingsProvider.embed(
      chunkArticle(article).map((chunk) => {
        chunks.push(chunk);

        return chunk.content;
      }),
    );

    embeddings.push(...subpathEmbeddings);
  }

  await addDocs(title, baseUrl, chunks, embeddings);

  yield {
    progress: 1,
    desc: "Done",
    status: "done",
  };
}
