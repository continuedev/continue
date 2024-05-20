import { Chunk, EmbeddingsProvider, IndexingProgressUpdate } from "../../index.js";

import { Article, chunkArticle, pageToArticle } from "./article.js";
import { crawlPage } from "./crawl.js";
import { addDocs, hasDoc } from "./db.js";
import {SiteIndexingConfig } from "../../index.js"

export async function* indexDocs(
  siteIndexingConfig: SiteIndexingConfig,
  embeddingsProvider: EmbeddingsProvider,
): AsyncGenerator<IndexingProgressUpdate> {
  console.log("In core indexDocs. maxDepth -> ", siteIndexingConfig.maxDepth, " Base Url -> ", siteIndexingConfig.startUrl)
  const startUrl = new URL(siteIndexingConfig.startUrl)
  
  if (await hasDoc(siteIndexingConfig.startUrl.toString())) {
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

  console.log("starting crawl loop")
  for await (const page of crawlPage(startUrl, siteIndexingConfig.maxDepth)) {
    const article = pageToArticle(page);
    if (!article) { continue; }

    console.log("pushing article")
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

  await addDocs(siteIndexingConfig.title, startUrl, chunks, embeddings);

  yield {
    progress: 1,
    desc: "Done",
    status: "done",
  };
}
