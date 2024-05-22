import { Chunk, EmbeddingsProvider, IndexingProgressUpdate } from "../../index.js";

import { Article, chunkArticle, pageToArticle } from "./article.js";
import { crawlPage } from "./crawl.js";
import { addDocs, hasDoc } from "./db.js";
import {SiteIndexingConfig } from "../../index.js"

export async function* indexDocs(
  siteIndexingConfig: SiteIndexingConfig,
  embeddingsProvider: EmbeddingsProvider,
): AsyncGenerator<IndexingProgressUpdate> {
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

  // Crawl pages and retrieve info as articles
  for await (const page of crawlPage(startUrl, siteIndexingConfig.maxDepth)) {
    const article = pageToArticle(page);
    if (!article) { continue; }
    articles.push(article);

    yield {
      progress: 0,
      desc: `Finding subpages (${page.path})`,
      status: "indexing",
    };
  }

  const chunks: Chunk[] = [];
  const embeddings: number[][] = [];

  
  // Create embeddings of retrieved articles
  console.log("Creating Embeddings for ", articles.length, " articles")
  for (const article of articles) {

    yield {
      progress: Math.max(1, Math.floor(100 / (articles.length + 1))),
      desc: `${article.subpath}`,
      status: "indexing",
    };

    try {
      const subpathEmbeddings = await embeddingsProvider.embed(
        chunkArticle(article).map((chunk) => {
          chunks.push(chunk);

          return chunk.content;
        }),
      );


      embeddings.push(...subpathEmbeddings);
    } catch (e) {
      console.warn("Error chunking article: ", e)
    }
  }

  // Add docs to databases
  console.log("Adding ", embeddings.length, " embeddings to db")
  await addDocs(siteIndexingConfig.title, startUrl, chunks, embeddings);

  yield {
    progress: 1,
    desc: "Done",
    status: "done",
  };
}
