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
  const words = article.body.split(/\s+/);
  let currentChunk = "";
  let startLine = 0;
  let index = 0;

  const createChunk = (
    content: string,
    currentStartLine: number,
    endLine: number,
  ) => {
    chunks.push({
      content: content.trim(),
      startLine: currentStartLine,
      endLine: endLine,
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

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // If a single word is longer than max_chunk_size, split it
    if (word.length > max_chunk_size) {
      // First, push the current chunk if it has content
      if (currentChunk.trim().length > 0) {
        createChunk(currentChunk.trim(), startLine, i - 1);
        currentChunk = "";
      }

      // Split the long word into smaller pieces
      let remainingWord = word;
      while (remainingWord.length > 0) {
        const chunk = remainingWord.slice(0, max_chunk_size);
        createChunk(chunk, i, i);
        remainingWord = remainingWord.slice(max_chunk_size);
      }

      startLine = i + 1;
      continue;
    }

    // Check if adding this word would exceed max_chunk_size
    if (currentChunk.length + word.length + 1 > max_chunk_size) {
      // Push current chunk if it has content
      if (currentChunk.trim().length > 0) {
        createChunk(currentChunk.trim(), startLine, i - 1);
      }

      // Start new chunk with current word
      currentChunk = word;
      startLine = i;
    } else {
      // Add word to current chunk
      currentChunk = currentChunk.length > 0 ? `${currentChunk} ${word}` : word;
    }
  }

  // Push the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    createChunk(currentChunk.trim(), startLine, words.length - 1);
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
