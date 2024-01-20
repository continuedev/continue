import cheerio from "cheerio";
import fetch from "node-fetch";
import { NodeHtmlMarkdown } from "node-html-markdown";

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
  console.log(text);
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

async function convertURLToMarkdown(url: string): Promise<string> {
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
const url1 = new URL("https://python-socketio.readthedocs.io/en/stable");
const url = new URL("https://platform.openai.com/docs/api-reference");
crawlLinks(url.pathname, url, visited).then(() => {
  console.log(visited);
});
