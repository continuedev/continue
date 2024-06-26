import {
  Chunk,
  EmbeddingsProvider,
  IndexingProgressUpdate,
} from "../../index.js";

import { SiteIndexingConfig } from "../../index.js";
import { Article, chunkArticle, pageToArticle } from "./article.js";
import { crawlPage } from "./crawl.js";
import { addDocs, hasDoc } from "./db.js";

export async function* indexDocs(
  siteIndexingConfig: SiteIndexingConfig,
  embeddingsProvider: EmbeddingsProvider,
): AsyncGenerator<IndexingProgressUpdate> {
  const startUrl = new URL(siteIndexingConfig.startUrl);

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
  let processedPages = 0;
  let maxKnownPages = 1;

  // Crawl pages and retrieve info as articles
  for await (const page of crawlPage(startUrl, siteIndexingConfig.maxDepth)) {
    processedPages++;
    const article = pageToArticle(page);
    if (!article) {
      continue;
    }
    articles.push(article);

    // Use a heuristic approach for progress calculation
    const progress = Math.min(processedPages / maxKnownPages, 1);

    yield {
      progress, // Yield the heuristic progress
      desc: `Finding subpages (${page.path})`,
      status: "indexing",
    };

    // Increase maxKnownPages to delay progress reaching 100% too soon
    if (processedPages === maxKnownPages) {
      maxKnownPages *= 2;
    }

  }

  const chunks: Chunk[] = [];
  const embeddings: number[][] = [];

  // Create embeddings of retrieved articles
  console.log("Creating Embeddings for ", articles.length, " articles");
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    yield {
      progress: i / articles.length,
      desc: `Creating Embeddings: ${article.subpath}`,
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
      console.warn("Error chunking article: ", e);
    }
  }

  // Add docs to databases
  console.log("Adding ", embeddings.length, " embeddings to db");
  yield {
    progress: 0.5,
    desc: `Adding ${embeddings.length} embeddings to db`,
    status: "indexing",
  };
  await addDocs(siteIndexingConfig.title, startUrl, chunks, embeddings);

  yield {
    progress: 1,
    desc: "Done",
    status: "done",
  };
}
