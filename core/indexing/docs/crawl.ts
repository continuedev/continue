import { Octokit } from "@octokit/rest";
import { URL } from "node:url";
import { EventEmitter } from "events";
import { getChromiumPath, getContinueUtilsPath } from "../../util/paths";
import { executablePath, Page } from "puppeteer";
// @ts-ignore
import PCR from "puppeteer-chromium-resolver";
import * as fs from "fs";

export type PageData = {
  url: string;
  path: string;
  content: string;
};

const MAX_TIME_TO_CRAWL = 1000 * 5;
const LINK_GROUP_SIZE = 2; // Controls parallelization of crawler
const GITHUB_HOST = "github.com";
const MAX_REQUESTS_PER_CRAWL = 1000;
const markdownRegex = new RegExp(/\.(md|mdx)$/);
const octokit = new Octokit({
  auth: undefined,
});

const PCR_CONFIG = {
  downloadPath: getContinueUtilsPath(),
};

export function verifyOrInstallChromium() {
  if (!fs.existsSync(getChromiumPath())) {
    PCR(PCR_CONFIG);
  }
}

async function getGithubRepoDefaultBranch(
  owner: string,
  repo: string,
): Promise<string> {
  const repoInfo = await octokit.repos.get({
    owner,
    repo,
  });

  return repoInfo.data.default_branch;
}

async function getGitHubRepoPaths(owner: string, repo: string, branch: string) {
  const tree = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
      owner,
      repo,
      tree_sha: branch,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      recursive: "true",
    },
  );

  const paths = tree.data.tree
    .filter(
      (file: any) =>
        file.type === "blob" && markdownRegex.test(file.path ?? ""),
    )
    .map((file: any) => file.path);

  return paths;
}

async function getGithubRepoFileContent(
  path: string,
  owner: string,
  repo: string,
) {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      headers: {
        Accept: "application/vnd.github.raw+json",
      },
    });

    return response.data as unknown as string;
  } catch (error) {
    console.debug("Error fetching file contents:", error);
    return null;
  }
}

async function* crawlGithubRepo(url: URL) {
  const urlStr = url.toString();
  const [_, owner, repo] = url.pathname.split("/");
  const branch = await getGithubRepoDefaultBranch(owner, repo);
  const paths = await getGitHubRepoPaths(owner, repo, branch);

  for await (const path of paths) {
    const content = await getGithubRepoFileContent(path, owner, repo);

    yield {
      path,
      url: urlStr,
      content: content ?? "",
    };
  }
}

async function getLinksFromPage(page: Page) {
  // The URL lib is not available by default in the page scope,
  // so we need to expose it to the page through this fn.
  await page.exposeFunction(
    "getCleanedUrlFromAnchorTag",
    (a: HTMLAnchorElement) => {
      let url = new URL(a.href);
      url.hash = "";
      return url.href;
    },
  );

  const links: string[] = await page.$$eval("a", (links) =>
    links.map((a) => (window as any).getCleanedUrlFromAnchorTag),
  );

  return links;
}

async function getLinkGroups(page: Page) {
  const links = await getLinksFromPage(page);

  const groups = links.reduce((acc, link, i) => {
    const groupIndex = Math.floor(i / LINK_GROUP_SIZE);

    if (!acc[groupIndex]) {
      acc.push([]);
    }

    acc[groupIndex].push(link);

    return acc;
  }, [] as string[][]);

  return groups;
}

function shouldSkipPage(url: URL, rootUrl: URL, visitedLinks: Set<string>) {
  const hasVisitedLink = visitedLinks.has(url.toString());
  const isInvalidHostOrPath =
    !url.pathname.startsWith(rootUrl.pathname) || rootUrl.host !== url.host;

  return hasVisitedLink || isInvalidHostOrPath;
}

async function* crawlSitePages(
  page: Page,
  url: URL,
  rootUrl: URL,
  maxRequestsPerCrawl: number,
  visitedLinks: Set<string> = new Set(),
  currentRequests: number = 0,
): AsyncGenerator<any> {
  if (currentRequests >= maxRequestsPerCrawl) {
    console.warn("Max requests per crawl reached. Stopping crawler.");
    return;
  }

  if (shouldSkipPage(url, rootUrl, visitedLinks)) {
    console.warn("Skipping ", url.toString());
    return;
  }

  await page.goto(url.toString());

  const htmlContent = await page.content();
  const linkGroups = await getLinkGroups(page);
  const requestCount = currentRequests + 1;

  visitedLinks.add(url.toString());

  yield {
    path: url.pathname,
    url: url.toString(),
    content: htmlContent,
  };

  for (const linkGroup of linkGroups) {
    for (const link of linkGroup) {
      yield* crawlSitePages(
        page,
        new URL(link),
        rootUrl,
        maxRequestsPerCrawl,
        visitedLinks,
        requestCount,
      );
    }
  }
}

async function* crawlSite(
  startUrl: URL,
  rootUrl: URL,
  maxRequestsPerCrawl: number,
): AsyncGenerator<PageData> {
  const stats = await PCR(PCR_CONFIG);

  const browser = await stats.puppeteer.launch({
    args: [
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    ],
    executablePath: stats.executablePath,
    // From the docs: https://pptr.dev/guides/headless-modes
    // If the performance is more important for your use case, switch to chrome-headless-shell as following:
    // { headless: "shell" }
    headless: "shell",
  });

  const page = await browser.newPage();

  try {
    yield* crawlSitePages(page, startUrl, rootUrl, maxRequestsPerCrawl);
  } catch (e) {
    console.debug("Error getting links: ", e);
  } finally {
    await browser.close();
  }
}

export async function* crawl(
  url: URL,
  maxRequestsPerCrawl: number = MAX_REQUESTS_PER_CRAWL,
): AsyncGenerator<PageData> {
  if (url.host === GITHUB_HOST) {
    yield* crawlGithubRepo(url);
  } else {
    // TODO: Why both
    yield* crawlSite(url, url, maxRequestsPerCrawl);
  }
}
