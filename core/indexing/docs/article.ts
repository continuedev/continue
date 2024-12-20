// Article processing and chunking module

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import { Chunk } from "../../";
import { cleanFragment, cleanHeader } from "../chunk/markdown";

import { type PageData } from "./DocsCrawler";

// Define types for article components and structure
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

// Break down an article component into smaller chunks
function breakdownArticleComponent(
  url: string,
  article: ArticleComponent,
  subpath: string,
  max_chunk_size: number,
): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = article.body.split("\n");
  let startLine = 0;
  let content = "";
  let index = 0;

  // Construct full URL for the article component
  const fullUrl = new URL(
    `${subpath}#${cleanFragment(article.title)}`,
    url,
  ).toString();

  // Helper function to create and add a chunk
  const createChunk = (
    chunkContent: string,
    chunkStartLine: number,
    chunkEndLine: number,
  ) => {
    if (chunkContent.trim().length > 20) {
      chunks.push({
        content: chunkContent.trim(),
        startLine: chunkStartLine,
        endLine: chunkEndLine,
        otherMetadata: {
          title: cleanHeader(article.title),
        },
        index: index++,
        filepath: fullUrl,
        digest: fullUrl,
      });
    }
  };

  // Process each line and create chunks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.length > max_chunk_size) {
      // Handle long lines by splitting them
      if (content.trim().length > 0) {
        createChunk(content, startLine, i - 1);
        content = "";
      }

      let remainingLine = line;
      while (remainingLine.length > 0) {
        const chunk = remainingLine.slice(0, max_chunk_size);
        createChunk(chunk, i, i);
        remainingLine = remainingLine.slice(max_chunk_size);
      }
      startLine = i + 1;
    } else if (content.length + line.length + 1 <= max_chunk_size) {
      // Add line to current chunk if it fits
      content += `${line}\n`;
    } else {
      // Create a new chunk if adding the line exceeds max size
      createChunk(content, startLine, i - 1);
      content = `${line}\n`;
      startLine = i;
    }
  }

  // Add any remaining content as a final chunk
  if (content.trim().length > 0) {
    createChunk(content, startLine, lines.length - 1);
  }

  return chunks;
}

// Chunk an entire article into smaller pieces
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

// Extract titles and bodies from HTML content
function extractTitlesAndBodies(html: string): ArticleComponent[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  );

  return headings
    .map((heading, index) => {
      const title = heading.textContent?.trim() || "";
      let body = "";
      let nextElement = heading.nextElementSibling;

      // Collect content until the next heading
      while (nextElement && !nextElement.tagName.match(/^H[1-6]$/)) {
        body += nextElement.textContent || "";
        nextElement = nextElement.nextElementSibling;
      }

      return { title, body: body.trim() };
    })
    .filter((component) => component.title && component.body);
}

// Convert HTML string to Article object
export function stringToArticle(
  url: string,
  html: string,
  subpath: string,
): Article | undefined {
  try {
    const dom = new JSDOM(html);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.content) {
      // Fallback to extracting titles and bodies if Readability fails
      return {
        url,
        subpath,
        title: dom.window.document.title || url,
        article_components: extractTitlesAndBodies(html),
      };
    }

    const article_components = extractTitlesAndBodies(article.content);

    return {
      url,
      subpath,
      title: article.title || dom.window.document.title || url,
      article_components:
        article_components.length > 0
          ? article_components
          : [{ title: "Main Content", body: article.textContent || "" }],
    };
  } catch (err) {
    console.error("Error converting URL to article components", err);
    return undefined;
  }
}

// Convert PageData to Article object
export function pageToArticle(page: PageData): Article | undefined {
  try {
    return stringToArticle(page.url, page.content, page.path);
  } catch (err) {
    console.error("Error converting URL to article components", err);
    return undefined;
  }
}
