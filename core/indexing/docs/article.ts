import { Readability } from "@mozilla/readability";
import { Chunk } from "../..";
import { MAX_CHUNK_SIZE } from "../../llm/constants";
import { cleanFragment, cleanHeader } from "../chunk/markdown";
import { PageData } from "./crawl";
import type jsdom from "jsdom";

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
): Chunk[] {
  let chunks: Chunk[] = [];

  let lines = article.body.split("\n");
  let startLine = 0;
  let endLine = 0;
  let content = "";
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (content.length + line.length <= MAX_CHUNK_SIZE) {
      content += line + "\n";
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
          subpath + `#${cleanFragment(article.title)}`,
          url,
        ).toString(),
        digest: subpath,
      });
      content = line + "\n";
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
        subpath + `#${cleanFragment(article.title)}`,
        url,
      ).toString(),
      digest: subpath,
    });
  }

  // Don't use small chunks. Probably they're a mistake. Definitely they'll confuse the embeddings model.
  return chunks.filter((c) => c.content.trim().length > 20);
}

export function chunkArticle(articleResult: Article): Chunk[] {
  let chunks: Chunk[] = [];

  for (let article of articleResult.article_components) {
    let articleChunks = breakdownArticleComponent(
      articleResult.url,
      article,
      articleResult.subpath,
    );
    chunks = [...chunks, ...articleChunks];
  }

  return chunks;
}

function htmlToJSDOM(html: string) {
  // This project uses the CommonJS module system.
  // Do not use inline `import` (of ES modules) here.
  // See https://github.com/continuedev/continue/pull/999
  const JSDOM = require("jsdom").JSDOM as typeof jsdom.JSDOM;
  return new JSDOM(html);
}

function extractTitlesAndBodies(
  html: string,
): ArticleComponent[] {
  const dom = htmlToJSDOM(html);
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
    const dom = htmlToJSDOM(html);
    let reader = new Readability(dom.window.document);
    let article = reader.parse();

    if (!article) {
      return undefined;
    }

    let article_components = extractTitlesAndBodies(article.content);

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

export function pageToArticle(
  page: PageData
): Article | undefined {
  try {
    return stringToArticle(page.url, page.html, page.path);
  } catch (err) {
    console.error("Error converting URL to article components", err);
    return undefined;
  }
}
