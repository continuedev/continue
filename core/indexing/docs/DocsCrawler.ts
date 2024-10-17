import { Octokit } from "@octokit/rest";
import * as cheerio from "cheerio";
import * as fs from "fs";
import fetch from "node-fetch";
import { URL } from "node:url";
import { Handler, HTTPResponse, Page } from "puppeteer";
import {
  editConfigJson,
  getChromiumPath,
  getContinueUtilsPath,
} from "../../util/paths";
// @ts-ignore
// @prettier-ignore
import PCR from "puppeteer-chromium-resolver";
import { ContinueConfig, IDE } from "../..";

export type PageData = {
  url: string;
  path: string;
  content: string;
};

class DocsCrawler {
  private readonly MAX_REQUESTS_PER_CRAWL = 1000;
  private readonly GITHUB_HOST = "github.com";
  private readonly chromiumInstaller: ChromiumInstaller;

  constructor(
    private readonly ide: IDE,
    private readonly config: ContinueConfig,
  ) {
    this.chromiumInstaller = new ChromiumInstaller(this.ide, this.config);
  }

  private shouldUseChromium() {
    return (
      this.config.experimental?.useChromiumForDocsCrawling &&
      this.chromiumInstaller.isInstalled()
    );
  }

  async *crawl(
    startUrl: URL,
    maxRequestsPerCrawl: number = this.MAX_REQUESTS_PER_CRAWL,
  ): AsyncGenerator<PageData> {
    if (startUrl.host === this.GITHUB_HOST) {
      yield* new GitHubCrawler(startUrl).crawl();
    } else if (this.shouldUseChromium()) {
      yield* new ChromiumCrawler(startUrl, maxRequestsPerCrawl).crawl();
    } else {
      let didCrawlSinglePage = false;

      for await (const pageData of new CheerioCrawler(
        startUrl,
        maxRequestsPerCrawl,
      ).crawl()) {
        yield pageData;
        didCrawlSinglePage = true;
      }

      // We assume that if we failed to crawl a single page,
      // it was due to an error that using Chromium can resolve
      const shouldProposeUseChromium =
        !didCrawlSinglePage &&
        this.chromiumInstaller.shouldProposeUseChromiumOnCrawlFailure();

      if (shouldProposeUseChromium) {
        const didInstall =
          await this.chromiumInstaller.proposeAndAttemptInstall(
            startUrl.toString(),
          );

        if (didInstall) {
          await this.ide.showToast(
            "info",
            `Successfully installed Chromium! Retrying crawl of: ${startUrl.toString()}`,
          );

          yield* new ChromiumCrawler(startUrl, maxRequestsPerCrawl).crawl();
        }
      }
    }
  }
}

class GitHubCrawler {
  private readonly markdownRegex = new RegExp(/\.(md|mdx)$/);
  private octokit = new Octokit({ auth: undefined });

  constructor(private readonly startUrl: URL) {}

  async *crawl(): AsyncGenerator<PageData> {
    console.debug(
      `[${
        (this.constructor as any).name
      }] Crawling GitHub repo: ${this.startUrl.toString()}`,
    );
    const urlStr = this.startUrl.toString();
    const [_, owner, repo] = this.startUrl.pathname.split("/");
    const branch = await this.getGithubRepoDefaultBranch(owner, repo);
    const paths = await this.getGitHubRepoPaths(owner, repo, branch);

    for await (const path of paths) {
      const content = await this.getGithubRepoFileContent(path, owner, repo);
      yield { path, url: urlStr, content: content ?? "" };
    }
  }

  private async getGithubRepoDefaultBranch(
    owner: string,
    repo: string,
  ): Promise<string> {
    const repoInfo = await this.octokit.repos.get({ owner, repo });
    return repoInfo.data.default_branch;
  }

  private async getGitHubRepoPaths(
    owner: string,
    repo: string,
    branch: string,
  ) {
    const tree = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      {
        owner,
        repo,
        tree_sha: branch,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
        recursive: "true",
      },
    );

    return tree.data.tree
      .filter(
        (file: any) =>
          file.type === "blob" && this.markdownRegex.test(file.path ?? ""),
      )
      .map((file: any) => file.path);
  }

  private async getGithubRepoFileContent(
    path: string,
    owner: string,
    repo: string,
  ) {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        headers: { Accept: "application/vnd.github.raw+json" },
      });
      return response.data as unknown as string;
    } catch (error) {
      console.debug("Error fetching file contents:", error);
      return null;
    }
  }
}

class CheerioCrawler {
  private readonly IGNORE_PATHS_ENDING_IN = [
    "favicon.ico",
    "robots.txt",
    ".rst.txt",
    "genindex",
    "py-modindex",
    "search.html",
    "search",
    "genindex.html",
    "changelog",
    "changelog.html",
  ];

  constructor(
    private readonly startUrl: URL,
    private readonly maxRequestsPerCrawl: number,
  ) {}

  async *crawl(): AsyncGenerator<PageData> {
    yield* this.crawlPage(this.startUrl);
  }

  private async *crawlPage(
    url: URL,
    maxDepth: number = 3,
  ): AsyncGenerator<PageData> {
    console.log(
      `[${
        (this.constructor as any).name
      }] Starting crawl from: ${url} - Max Depth: ${maxDepth}`,
    );

    const { baseUrl, basePath } = this.splitUrl(url);

    let paths: { path: string; depth: number }[] = [
      { path: basePath, depth: 0 },
    ];

    let index = 0;

    while (index < paths.length) {
      const batch = paths.slice(index, index + 50);

      try {
        const promises = batch.map(({ path, depth }) =>
          this.getLinksFromUrl(baseUrl, path).then((links) => ({
            links,
            path,
            depth,
          })),
        );

        const results = await Promise.all(promises);
        for (const {
          links: { html, links: linksArray },
          path,
          depth,
        } of results) {
          if (html !== "" && depth <= maxDepth) {
            yield { url: url.toString(), path, content: html };
          }

          if (depth < maxDepth) {
            for (let link of linksArray) {
              if (!paths.some((p) => p.path === link)) {
                paths.push({ path: link, depth: depth + 1 });
              }
            }
          }
        }
      } catch (e) {
        console.debug("Error while crawling page: ", e);
      }

      index += batch.length;
    }

    console.log("Crawl completed");
  }

  private async getLinksFromUrl(url: string, path: string) {
    const baseUrl = new URL(url);
    const location = new URL(path, url);
    let response;

    try {
      response = await fetch(location.toString());
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("maximum redirect")
      ) {
        console.error(
          `[${
            (this.constructor as any).name
          }] Maximum redirect reached for: ${location.toString()}`,
        );
        return { html: "", links: [] };
      }
      console.error(error);
      return { html: "", links: [] };
    }
    if (!response.ok) {
      return { html: "", links: [] };
    }
    const html = await response.text();
    let links: string[] = [];

    if (url.includes("github.com")) {
      return { html, links };
    }

    const $ = cheerio.load(html);

    $("a").each((_: any, element: any) => {
      const href = $(element).attr("href");
      if (!href) {
        return;
      }

      const parsedUrl = new URL(href, location);
      if (parsedUrl.hostname === baseUrl.hostname) {
        links.push(parsedUrl.pathname);
      }
    });

    links = [...new Set(links)].filter((link) => {
      return (
        !link.includes("#") &&
        !this.IGNORE_PATHS_ENDING_IN.some((ending) => link.endsWith(ending))
      );
    });
    return { html, links };
  }

  private splitUrl(url: URL) {
    const baseUrl = new URL('/', url).href;
    const basePath = url.pathname;
    return { baseUrl, basePath };
  }
}

class ChromiumCrawler {
  private readonly LINK_GROUP_SIZE = 2;
  private curCrawlCount = 0;

  constructor(
    private readonly startUrl: URL,
    private readonly maxRequestsPerCrawl: number,
  ) {}

  static setUseChromiumForDocsCrawling(useChromiumForDocsCrawling: boolean) {
    editConfigJson((config) => ({
      ...config,
      experimental: {
        ...config.experimental,
        useChromiumForDocsCrawling,
      },
    }));
  }

  async *crawl(): AsyncGenerator<PageData> {
    console.debug(
      `[${(this.constructor as any).name}] Crawling site: ${this.startUrl}`,
    );

    const stats = await PCR(ChromiumInstaller.PCR_CONFIG);
    const browser = await stats.puppeteer.launch({
      args: [
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
      ],
      executablePath: stats.executablePath,
    });
    const page = await browser.newPage();

    try {
      yield* this.crawlSitePages(page, this.startUrl);
    } catch (e) {
      console.debug("Error getting links: ", e);
      console.debug(
        "Setting 'useChromiumForDocsCrawling' to 'false' in config.json",
      );

      ChromiumCrawler.setUseChromiumForDocsCrawling(false);
    } finally {
      await browser.close();
    }
  }

  /**
   * We need to handle redirects manually, otherwise there are race conditions.
   *
   * https://github.com/puppeteer/puppeteer/issues/3323#issuecomment-2332333573
   */
  private async gotoPageAndHandleRedirects(page: Page, url: string) {
    const MAX_PAGE_WAIT_MS = 5000;

    await page.goto(url, {
      timeout: 0,
      waitUntil: "networkidle2",
    });

    let responseEventOccurred = false;
    const responseHandler: Handler<HTTPResponse> = (event) =>
      (responseEventOccurred = true);

    const responseWatcher = new Promise<void>(function (resolve, reject) {
      setTimeout(() => {
        if (!responseEventOccurred) {
          resolve();
        } else {
          setTimeout(() => resolve(), MAX_PAGE_WAIT_MS);
        }
      }, 500);
    });

    page.on("response", responseHandler);

    await Promise.race([responseWatcher, page.waitForNavigation()]);
  }

  private async *crawlSitePages(
    page: Page,
    curUrl: URL,
    visitedLinks: Set<string> = new Set(),
  ): AsyncGenerator<PageData> {
    const urlStr = curUrl.toString();

    if (visitedLinks.has(urlStr)) {
      return;
    }

    await this.gotoPageAndHandleRedirects(page, urlStr);

    const htmlContent = await page.content();
    const linkGroups = await this.getLinkGroupsFromPage(page, curUrl);
    this.curCrawlCount++;

    visitedLinks.add(urlStr);

    yield {
      path: curUrl.pathname,
      url: urlStr,
      content: htmlContent,
    };

    for (const linkGroup of linkGroups) {
      let enqueuedLinkCount = this.curCrawlCount;

      for (const link of linkGroup) {
        enqueuedLinkCount++;
        console.log({ enqueuedLinkCount, url: this.startUrl.toString() });
        if (enqueuedLinkCount <= this.maxRequestsPerCrawl) {
          yield* this.crawlSitePages(page, new URL(link), visitedLinks);
        }
      }
    }
  }

  private stripHashFromUrl(urlStr: string) {
    try {
      let url = new URL(urlStr);
      url.hash = "";
      return url;
    } catch (err) {
      return null;
    }
  }

  private isValidHostAndPath(newUrl: URL, curUrl: URL) {
    return (
      newUrl.pathname.startsWith(curUrl.pathname) && newUrl.host === curUrl.host
    );
  }

  private async getLinksFromPage(page: Page, curUrl: URL) {
    const links = await page.$$eval("a", (links) => links.map((a) => a.href));

    const cleanedLinks = links
      .map(this.stripHashFromUrl)
      .filter(
        (newUrl) =>
          newUrl !== null &&
          this.isValidHostAndPath(newUrl, curUrl) &&
          newUrl !== curUrl,
      )
      .map((newUrl) => (newUrl as URL).href);

    const dedupedLinks = Array.from(new Set(cleanedLinks));

    return dedupedLinks;
  }

  private async getLinkGroupsFromPage(page: Page, curUrl: URL) {
    const links = await this.getLinksFromPage(page, curUrl);

    const groups = links.reduce((acc, link, i) => {
      const groupIndex = Math.floor(i / this.LINK_GROUP_SIZE);

      if (!acc[groupIndex]) {
        acc.push([]);
      }

      acc[groupIndex].push(link);

      return acc;
    }, [] as string[][]);

    return groups;
  }
}

class ChromiumInstaller {
  static PCR_CONFIG = { downloadPath: getContinueUtilsPath() };

  constructor(
    private readonly ide: IDE,
    private readonly config: ContinueConfig,
  ) {
    if (this.shouldInstallOnStartup()) {
      console.log("Installing Chromium");
      void this.install();
    }
  }

  isInstalled() {
    return fs.existsSync(getChromiumPath());
  }

  shouldInstallOnStartup() {
    return (
      !this.isInstalled() &&
      this.config.experimental?.useChromiumForDocsCrawling
    );
  }

  shouldProposeUseChromiumOnCrawlFailure() {
    const { experimental } = this.config;

    return (
      experimental?.useChromiumForDocsCrawling === undefined ||
      experimental.useChromiumForDocsCrawling
    );
  }

  async proposeAndAttemptInstall(site: string) {
    const userAcceptedInstall = await this.proposeInstall(site);

    if (userAcceptedInstall) {
      const didInstall = await this.install();
      return didInstall;
    }
  }

  async install() {
    try {
      await PCR(ChromiumInstaller.PCR_CONFIG);

      ChromiumCrawler.setUseChromiumForDocsCrawling(true);

      return true;
    } catch (error) {
      console.debug("Error installing Chromium : ", error);
      console.debug(
        "Setting 'useChromiumForDocsCrawling' to 'false' in config.json",
      );

      ChromiumCrawler.setUseChromiumForDocsCrawling(false);

      await this.ide.showToast("error", "Failed to install Chromium");

      return false;
    }
  }

  private async proposeInstall(site: string) {
    const msg =
      `Unable to crawl documentation site: ${site}\n` +
      "We recommend installing Chromium. " +
      "Download progress can be viewed in the developer console.";

    const actionMsg = "Install Chromium";

    const res = await this.ide.showToast("warning", msg, actionMsg);

    return res === actionMsg;
  }
}

export default DocsCrawler;
export {
  CheerioCrawler,
  ChromiumCrawler,
  ChromiumInstaller as ChromiumInstaller,
  GitHubCrawler,
};
