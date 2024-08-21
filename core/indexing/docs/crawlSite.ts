import { Octokit } from "@octokit/rest";
import { URL } from "node:url";
import {
  PlaywrightCrawler,
  Configuration,
  LogLevel,
} from "@crawlee/playwright";
import { EventEmitter } from "events";
import { installChromium, isChromiumInstalled } from "./installChromium";
import { getChromiumExecutablePath } from "../../util/paths";
import * as os from "os";

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

  if (!isChromiumInstalled()) {
    await installChromium();
  }

  const emitter = new CrawlEmitter();

  const crawler = new PlaywrightCrawler(
    {
      async requestHandler({ request, page, enqueueLinks }) {
        const { pathname: path } = new URL(request.loadedUrl);
        const content = await page.content();

        emitter.emit("data", { url, content, path });

        await enqueueLinks();
      },
      maxRequestsPerCrawl,
      launchContext: {
        launchOptions: {
          executablePath: getChromiumExecutablePath(os.platform())!,
        },
      },
    },
    new Configuration({
      persistStorage: false,
      logLevel: process.env.NODE_ENV === "test" ? LogLevel.DEBUG : LogLevel.OFF,
    }),
  );

  const crawlerPromise = new Promise<typeof IS_DONE_CRAWLING>((resolve) => {
    crawler.run([url]).then(() => {
      resolve(IS_DONE_CRAWLING);
    });
  });

  while (true) {
    const dataPromise = new Promise<PageData>((resolve) => {
      emitter.on("data", resolve);
    });

    const result = await Promise.race([dataPromise, crawlerPromise]);

    if (result === IS_DONE_CRAWLING) {
      break;
    }

    yield result as PageData;
  }
}
