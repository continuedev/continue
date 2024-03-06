import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { MAX_CHUNK_SIZE } from "../../llm/constants";
import { Chunk } from "../..";

type ArticleComponent = {
  title: string;
  body: string;
};

type Article = {
  subpath: string;
  title: string;
  article_components: ArticleComponent[];
};

function breakdownArticleComponent(article: ArticleComponent, subpath: string): Chunk[] {
  let chunks: Chunk[] = [];

  let lines = article.body.split('\n');
  let startLine = 0;
  let endLine = 0;
  let content = '';
  let index = 0;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (content.length + line.length <= MAX_CHUNK_SIZE) {
      content += line + '\n';
      endLine = i;
    } else {
      chunks.push({
        content: content,
        startLine: startLine,
        endLine: endLine,
        otherMetadata: {
          title: article.title
        },
        index: index,
        filepath: subpath,
        digest: subpath
      });
      content = line + '\n';
      startLine = i;
      endLine = i;
      index += 1;
    }
  }

  // Push the last chunk
  if (content) {
    chunks.push({
      content: content,
      startLine: startLine,
      endLine: endLine,
      otherMetadata: {
        title: article.title
      },
        index: index,
        filepath: subpath,
        digest: subpath
    });
  }

  return chunks;
}

export function chunkArticle(articleResult: Article): Chunk[] {
  let chunks: Chunk[] = [];
  
  for (let article of articleResult.article_components) {
    let articleChunks = breakdownArticleComponent(article, articleResult.subpath);
    chunks = [...chunks, ...articleChunks];
  }

  return chunks;
}

function extractTitlesAndBodies(html: string): ArticleComponent[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const titles = Array.from(document.querySelectorAll('h2'));
    const result = titles.map((titleElement) => {
        const title = titleElement.textContent || '';
        let body = '';
        let nextSibling = titleElement.nextElementSibling;

        while (nextSibling && nextSibling.tagName !== 'H2') {
            body += nextSibling.textContent || '';
            nextSibling = nextSibling.nextElementSibling;
        }

        return { title, body };
    });

    return result;
}

export async function urlToArticle(
  subpath: string,
  baseUrl: URL,
): Promise<Article | undefined> {
  const url = new URL(subpath, baseUrl);
  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return undefined;
    }

    const htmlContent = await response.text();
    const dom = new JSDOM(htmlContent);
    let reader = new Readability(dom.window.document);
    let article = reader.parse();

    if (!article) {
      return undefined;
    }

    let article_components = extractTitlesAndBodies(article.content);
    return {
      subpath,
      title: article.title,
      article_components,
    };
  } catch (err) {
    console.error("Error converting URL to article components", err);
    return undefined;
  }
}