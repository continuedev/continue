import cheerio from "cheerio";
import fetch from "node-fetch";
import { NodeHtmlMarkdown } from "node-html-markdown";
// const HCCrawler = require("headless-chrome-crawler");

const IGNORE_PATHS_ENDING_IN = ["favicon.ico", "robots.txt", ".rst.txt"];

function shouldFilterPath(pathname: string): boolean {
  if (IGNORE_PATHS_ENDING_IN.some((path) => pathname.endsWith(path)))
    return true;
  return false;
}

async function crawlLinks(path: string, baseUrl: URL, visited: Set<string>) {
  if (visited.has(path)) {
    return;
  }
  visited.add(path);

  const response = await fetch(new URL(path, baseUrl));
  const text = await response.text();
  const $ = cheerio.load(text);

  const children: string[] = [];
  $("a").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const parsedUrl = new URL(href, baseUrl);
    if (
      parsedUrl.hostname === baseUrl.hostname &&
      !visited.has(parsedUrl.pathname)
    ) {
      children.push(parsedUrl.pathname);
    }
  });

  await Promise.all(
    children.map((child) => crawlLinks(child, baseUrl, visited))
  );
}

export async function crawlSubpages(baseUrl: URL) {
  const visited = new Set<string>();
  await crawlLinks(baseUrl.pathname, baseUrl, visited);
  return [...visited];
}

// class NoEscapeTurndownService extends TurndownService {
//   escape(str: string): string {
//     return str;
//   }
// }

// async function convertURLToMarkdown(url: string): Promise<string> {
//   try {
//     const response = await fetch(url);
//     const htmlContent = await response.text();
//     const turndown = new NoEscapeTurndownService({
//       codeBlockStyle: "fenced",
//       headingStyle: "atx",
//     }).use([turndownPluginGfm.tables, turndownPluginGfm.strikethrough]);
//     const markdown = turndown.turndown(htmlContent);
//     return markdown;
//   } catch (err) {
//     console.error(err);
//     throw new Error("Error converting URL to markdown");
//   }
// }

const nhm = new NodeHtmlMarkdown({}, undefined, undefined);

export async function convertURLToMarkdown(url: URL): Promise<string> {
  try {
    const response = await fetch(url);
    const htmlContent = await response.text();
    const markdown = nhm.translate(htmlContent).trimEnd();
    return markdown;
  } catch (err) {
    console.error(err);
    throw new Error("Error converting URL to markdown");
  }
}

// convertURLToMarkdown("https://python-socketio.readthedocs.io/en/stable").then(
//   (md) => {
//     console.log(md);
//   }
// );

let visited = new Set<string>();
const url = new URL("https://python-socketio.readthedocs.io/en/stable");
const url2 = new URL("https://platform.openai.com/docs/api-reference");
// crawlLinks(url.pathname, url, visited).then(() => {
//   console.log(visited);
// });

// async function hcCrawlLinks() {
//   const results: any[] = [];
//   const crawler = await HCCrawler.launch({
//     // Function to be evaluated in browsers
//     evaluatePage: () => ({
//       title: $("title").text(),
//     }),
//     // Function to be called with evaluated results from browsers
//     onSuccess: (result: any) => {
//       console.log(result);
//       results.push(result.url);
//     },
//   });
//   // Queue a request
//   await crawler.queue(url.toString());
//   await crawler.onIdle(); // Resolved when no queue is left
//   await crawler.close(); // Close the crawler

//   return results;
// }
