import { Octokit } from "@octokit/rest";
import { URL } from "node:url";
import { EventEmitter } from "events";
import { getChromiumPath, getContinueUtilsPath } from "../../util/paths";
import { Page } from "puppeteer";
// @ts-ignore
import PCR from "puppeteer-chromium-resolver";
import * as fs from "fs";

export type PageData = {
  url: string;
  path: string;
  content: string;
};

const IS_DONE_CRAWLING = "IS_DONE_CRAWLING";
const MAX_REQUESTS_PER_CRAWL = 1000;
const markdownRegex = new RegExp(/\.(md|mdx)$/);
const octokit = new Octokit({
  auth: undefined,
});

class CrawlEmitter extends EventEmitter {
  emit(event: "data", data: PageData): boolean;
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
}

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

async function* getLinks(
  page: Page,
  url: URL,
  rootUrl: URL,
  visitedLinks: Map<string, string>,
  depthRemaining: number,
) {
  if (
    visitedLinks.has(url.toString()) ||
    depthRemaining === 0 ||
    !url.pathname.startsWith(rootUrl.pathname) ||
    rootUrl.host !== url.host
  ) {
    console.warn("Skipping", url.toString());
    return;
  }

  await page.goto(url.toString());

  const htmlContent = await page.content();

  visitedLinks.set(url.toString(), htmlContent);

  const x = await page.$$eval("a", (a) => {
    console.log(a);
    return a;
  });

  const aCount = await page.$$eval("a", (as) => as.length);

  const links: any[] = await page.$$eval(
    "a",
    (as) =>
      as.map((a) => {
        try {
          debugger;
          let url = new URL(a.href);
          url.hash = "";
          return url.href;
        } catch (e) {
          return null;
        }
      }),
    // .filter((l) => l !== null) as string[],
  );

  const N = 2;
  const groups = links.reduce((acc, link, i) => {
    const groupIndex = Math.floor(i / N);
    if (!acc[groupIndex]) {
      acc.push([]);
    }
    acc[groupIndex].push(link);
    return acc;
  }, [] as string[][]);

  yield "" as any;

  for (const group of groups) {
    await Promise.all(
      group.map((link) => {
        return Promise.race([
          (async () => {
            try {
              return await getLinks(
                page,
                new URL(link),
                rootUrl,
                visitedLinks,
                depthRemaining - 1,
              );
            } catch (e: any) {
              console.warn("Error getting links from page: ", e.message);
              return Promise.resolve();
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      }),
    );
  }
}

// async function* crawlLinks(
//   page: Page,
//   url: URL,
//   rootUrl: URL,
//   visitedLinks: Map<string, string>,
//   depthRemaining: number,
// ): AsyncGenerator<PageData> {
//   if (
//     visitedLinks.has(url.toString()) ||
//     depthRemaining === 0 ||
//     !url.pathname.startsWith(rootUrl.pathname) ||
//     rootUrl.host !== url.host
//   ) {
//     console.warn("Skipping", url.toString());
//     return;
//   }

//   await page.goto(url.toString());

//   const htmlContent = await page.content();
//   visitedLinks.set(url.toString(), htmlContent);

//   yield {
//     url: url.toString(),
//     path: url.pathname,
//     content: htmlContent,
//   };

//   const links: string[] = await page.$$eval(
//     "a",
//     (as) =>
//       as
//         .map((a) => {
//           try {
//             let url = new URL(a.href);
//             url.hash = "";
//             return url.href;
//           } catch (e) {
//             return null;
//           }
//         })
//         .filter((l) => l !== null) as string[],
//   );

//   for (const link of links) {
//     yield* crawlLinks(
//       page,
//       new URL(link),
//       rootUrl,
//       visitedLinks,
//       depthRemaining - 1,
//     );
//   }
// }

async function* crawl(
  startUrl: string,
  rootUrl: URL,
): AsyncGenerator<PageData> {
  console.log(`Crawling ${startUrl}`);

  const stats = await PCR(PCR_CONFIG);

  const browser = await stats.puppeteer.launch({
    args: [
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    ],
    executablePath: stats.executablePath,
    headless: false, // TODO
  });

  const page = await browser.newPage();

  const maxDepth = 3;
  const visitedLinks = new Map<string, string>();

  try {
    yield* getLinks(page, new URL(startUrl), rootUrl, visitedLinks, maxDepth);
  } catch (e) {
    console.log("Error getting links: ", e);
  } finally {
    await browser.close();
  }
}

export async function* crawlSite(
  url: string,
  maxRequestsPerCrawl: number = MAX_REQUESTS_PER_CRAWL,
): AsyncGenerator<PageData> {
  if (url.includes("github.com")) {
    for await (const pageData of crawlGithubRepo(new URL(url))) {
      yield pageData;
    }
    return;
  }

  yield* crawl(url, new URL(url));
  // const emitter = new CrawlEmitter();

  // const crawler = new PlaywrightCrawler(
  //   {
  //     async requestHandler({ request, page, enqueueLinks }) {
  //       const { pathname: path } = new URL(request.loadedUrl);
  //       const content = await page.content();

  //       emitter.emit("data", { url, content, path });

  //       await enqueueLinks();
  //     },
  //     maxRequestsPerCrawl,
  //     launchContext: {
  //       launchOptions: {
  //         executablePath: getChromiumExecutablePath(os.platform())!,
  //       },
  //     },
  //   },
  //   new Configuration({
  //     persistStorage: false,
  //     logLevel: process.env.NODE_ENV === "test" ? LogLevel.DEBUG : LogLevel.OFF,
  //   }),
  // );
  // const options = {};

  // const crawlerPromise = new Promise<typeof IS_DONE_CRAWLING>((resolve) => {
  //   crawler.run([url]).then(() => {
  //     resolve(IS_DONE_CRAWLING);
  //   });
  // });

  // while (true) {
  //   const dataPromise = new Promise<PageData>((resolve) => {
  //     emitter.on("data", resolve);
  //   });

  //   const result = await Promise.race([dataPromise, crawlerPromise]);

  //   if (result === IS_DONE_CRAWLING) {
  //     break;
  //   }

  //   yield result as PageData;
  // }
}
