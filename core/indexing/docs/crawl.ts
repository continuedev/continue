import { Octokit } from "@octokit/rest";
import cheerio from "cheerio";
import fetch from "node-fetch";
// const HCCrawler = require("headless-chrome-crawler");

const IGNORE_PATHS_ENDING_IN = [
  "favicon.ico",
  "robots.txt",
  ".rst.txt",
  // ReadTheDocs
  "genindex",
  "py-modindex",
  "search.html",
  "search",
  "genindex.html",
  "changelog",
  "changelog.html",
];

const GITHUB_PATHS_TO_TRAVERSE = ["/blob/", "/tree/"];

function shouldFilterPath(pathname: string, baseUrl: URL): boolean {
  if (pathname.includes("#")) {
    pathname = pathname.slice(0, pathname.indexOf("#"));
  }

  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  if (baseUrl.hostname === "github.com") {
    if (
      pathname.split("/").length > 3 &&
      !GITHUB_PATHS_TO_TRAVERSE.some((path) => pathname.includes(path))
    )
      return true;
    return false;
  }

  if (IGNORE_PATHS_ENDING_IN.some((path) => pathname.endsWith(path)))
    return true;
  return false;
}

async function* crawlLinks(
  path: string,
  baseUrl: URL,
  visited: Set<string>,
): AsyncGenerator<number> {
  if (visited.has(path) || shouldFilterPath(path, baseUrl)) {
    return;
  }
  visited.add(path);
  yield visited.size;

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
      !visited.has(parsedUrl.pathname) &&
      parsedUrl.pathname.startsWith(baseUrl.pathname)
    ) {
      children.push(parsedUrl.pathname);
    }
  });

  await Promise.all(
    children.map(async (child) => {
      for await (const _ of crawlLinks(child, baseUrl, visited)) {
      }
    }),
  );
  yield visited.size;
}

async function crawlGithubRepo(baseUrl: URL) {
  const octokit = new Octokit({
    auth: undefined,
  });

  const [_, owner, repo] = baseUrl.pathname.split("/");

  let dirContentsConfig = {
    owner: owner,
    repo: repo,
  };

  const tree = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
      owner,
      repo,
      tree_sha: "main",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      recursive: "true",
    },
  );

  const paths = tree.data.tree
    .filter(
      (file) => file.type === "blob" && file.path?.endsWith(".md"),
      // ||
      // file.path?.endsWith(".rst") ||
      // file.path?.split("/").includes("documentation") ||
      // file.path?.split("/").includes("docs") ||
      // file.path?.split("/").includes("doc") ||
      // file.path?.split("/").includes("examples") ||
      // file.path?.split("/").includes("example")
    )
    .map((file) => baseUrl.pathname + "/tree/main/" + file.path);

  return paths;
}

export async function* crawlSubpages(
  baseUrl: URL,
): AsyncGenerator<number, string[]> {
  // Special case for GitHub repos
  if (baseUrl.hostname === "github.com") {
    return crawlGithubRepo(baseUrl);
  }

  // First, check if the parent of the path redirects to the same page
  if (baseUrl.pathname.endsWith("/")) {
    baseUrl.pathname = baseUrl.pathname.slice(0, -1);
  }
  let realBaseUrl = new URL(baseUrl);
  while (true) {
    let parentUrl = new URL(realBaseUrl);
    parentUrl.pathname = parentUrl.pathname.split("/").slice(0, -1).join("/");
    if (
      parentUrl.pathname === realBaseUrl.pathname ||
      parentUrl.pathname === ""
    ) {
      break;
    }
    const response = await fetch(parentUrl);
    const redirected = response.url.toString() === baseUrl.toString() + "/";
    if (!redirected) {
      break;
    }
    realBaseUrl = parentUrl;
  }

  const visited = new Set<string>();
  for await (const count of crawlLinks(
    realBaseUrl.pathname || "/",
    realBaseUrl,
    visited,
  )) {
    yield count;
  }
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
