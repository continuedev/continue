import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import { Chunk } from "../../";
import { cleanFragment, cleanHeader } from "../chunk/markdown";

import { type PageData } from "./DocsCrawler";

export type ArticleComponent = {
  title: string;
  body: string;
};

export type Article = {
  url: string;
  subpath: string;
  title: string;
  article_components: ArticleComponent[];
};

function breakdownArticleComponent(
  url: string,
  article: ArticleComponent,
  subpath: string,
  max_chunk_size: number,
): Chunk[] {
  const chunks: Chunk[] = [];

  const lines = article.body.split("\n");
  let startLine = 0;
  let endLine = 0;
  let content = "";
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (content.length + line.length <= max_chunk_size) {
      content += `${line}\n`;
      endLine = i;
    } else {
      chunks.push({
        content: content.trim(),
        startLine: startLine,
        endLine: endLine,
        otherMetadata: {
          title: cleanHeader(article.title),
        },
        index: index,
        filepath: new URL(
          `${subpath}#${cleanFragment(article.title)}`,
          url,
        ).toString(),
        digest: subpath,
      });
      content = `${line}\n`;
      startLine = i;
      endLine = i;
      index += 1;
    }
  }

  // Push the last chunk
  if (content) {
    chunks.push({
      content: content.trim(),
      startLine: startLine,
      endLine: endLine,
      otherMetadata: {
        title: cleanHeader(article.title),
      },
      index: index,
      filepath: new URL(
        `${subpath}#${cleanFragment(article.title)}`,
        url,
      ).toString(),
      digest: subpath,
    });
  }

  // Don't use small chunks. Probably they're a mistake. Definitely they'll confuse the embeddings model.
  return chunks.filter((c) => c.content.trim().length > 20);
}

export function chunkArticle(
  articleResult: Article,
  maxChunkSize: number,
): Chunk[] {
  let chunks: Chunk[] = [];

  for (const article of articleResult.article_components) {
    const articleChunks = breakdownArticleComponent(
      articleResult.url,
      article,
      articleResult.subpath,
      maxChunkSize,
    );
    chunks = [...chunks, ...articleChunks];
  }

  return chunks;
}

function extractTitlesAndBodies(html: string): ArticleComponent[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const titles = Array.from(document.querySelectorAll("h2"));
  const result = titles.map((titleElement) => {
    const title = titleElement.textContent || "";
    let body = "";
    let nextSibling = titleElement.nextElementSibling;

    while (nextSibling && nextSibling.tagName !== "H2") {
      body += nextSibling.textContent || "";
      nextSibling = nextSibling.nextElementSibling;
    }

    return { title, body };
  });

  return result;
}
export function stringToArticle(
  url: string,
  html: string,
  subpath: string,
): Article | undefined {
  try {
    const dom = new JSDOM(html);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return undefined;
    }

    const article_components = extractTitlesAndBodies(article.content);

    return {
      url,
      subpath,
      title: article.title,
      article_components,
    };
  } catch (err) {
    console.error("Error converting URL to article components", err);
    return undefined;
  }
}

export function pageToArticle(page: PageData): Article | undefined {
  try {
    return stringToArticle(page.url, page.content, page.path);
  } catch (err) {
    console.error("Error converting URL to article components", err);
    return undefined;
  }
}
