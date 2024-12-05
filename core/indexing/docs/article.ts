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

  const createChunk = (
    chunkContent: string,
    chunkStartLine: number,
    chunkEndLine: number,
  ) => {
    chunks.push({
      content: chunkContent.trim(),
      startLine: chunkStartLine,
      endLine: chunkEndLine,
      otherMetadata: {
        title: cleanHeader(article.title),
      },
      index: index++,
      filepath: new URL(
        `${subpath}#${cleanFragment(article.title)}`,
        url,
      ).toString(),
      digest: subpath,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle oversized lines by splitting them
    if (line.length > max_chunk_size) {
      // First push any accumulated content
      if (content.trim().length > 0) {
        createChunk(content, startLine, endLine);
        content = "";
      }

      // Split the long line into chunks
      let remainingLine = line;
      let subLineStart = i;
      while (remainingLine.length > 0) {
        const chunk = remainingLine.slice(0, max_chunk_size);
        createChunk(chunk, subLineStart, i);
        remainingLine = remainingLine.slice(max_chunk_size);
      }
      startLine = i + 1;
      continue;
    }

    // Normal line handling
    if (content.length + line.length + 1 <= max_chunk_size) {
      content += `${line}\n`;
      endLine = i;
    } else {
      if (content.trim().length > 0) {
        createChunk(content, startLine, endLine);
      }
      content = `${line}\n`;
      startLine = i;
      endLine = i;
    }
  }

  // Push the last chunk
  if (content.trim().length > 0) {
    createChunk(content, startLine, endLine);
  }

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
