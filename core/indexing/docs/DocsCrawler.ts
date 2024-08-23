import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import { URL } from "node:url";
import { Page } from "puppeteer";
import { getChromiumPath, getContinueUtilsPath } from "../../util/paths";
// @ts-ignore
// @prettier-ignore
import PCR from "puppeteer-chromium-resolver";

export type PageData = {
  url: string;
  path: string;
  content: string;
};

export default class DocsCrawler {
  LINK_GROUP_SIZE = 2; // Controls parallelization of crawler
  GITHUB_HOST = "github.com";
  static MAX_REQUESTS_PER_CRAWL = 1000;
  markdownRegex = new RegExp(/\.(md|mdx)$/);
  octokit = new Octokit({
    auth: undefined,
  });

  static PCR_CONFIG = {
    downloadPath: getContinueUtilsPath(),
  };

  constructor(
    private readonly startUrl: URL,
    private readonly maxRequestsPerCrawl: number = DocsCrawler.MAX_REQUESTS_PER_CRAWL,
  ) {}

  static verifyOrInstallChromium() {
    if (!fs.existsSync(getChromiumPath())) {
      PCR(DocsCrawler.PCR_CONFIG);
    }
  }

  async *crawl(): AsyncGenerator<PageData> {
    if (this.startUrl.host === this.GITHUB_HOST) {
      yield* this.crawlGithubRepo();
    } else {
      yield* this.crawlSite();
    }
  }

  private async getGithubRepoDefaultBranch(
    owner: string,
    repo: string,
  ): Promise<string> {
    const repoInfo = await this.octokit.repos.get({
      owner,
      repo,
    });

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
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
        recursive: "true",
      },
    );

    const paths = tree.data.tree
      .filter(
        (file: any) =>
          file.type === "blob" && this.markdownRegex.test(file.path ?? ""),
      )
      .map((file: any) => file.path);

    return paths;
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

  private async *crawlGithubRepo() {
    console.debug(`Crawling GitHub repo: ${this.startUrl.toString()}`);

    const urlStr = this.startUrl.toString();
    const [_, owner, repo] = this.startUrl.pathname.split("/");
    const branch = await this.getGithubRepoDefaultBranch(owner, repo);
    const paths = await this.getGitHubRepoPaths(owner, repo, branch);

    for await (const path of paths) {
      const content = await this.getGithubRepoFileContent(path, owner, repo);

      yield {
        path,
        url: urlStr,
        content: content ?? "",
      };
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

    // This additional step is due to issues getting the URL module to work
    // in an $$eval command
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

  private async *crawlSitePages(
    page: Page,
    curUrl: URL,
    visitedLinks: Set<string> = new Set(),
    curRequestCount: number = 0,
  ): AsyncGenerator<PageData> {
    if (curRequestCount >= this.maxRequestsPerCrawl) {
      console.warn("Max requests per crawl reached. Stopping crawler.");
      return;
    }

    if (visitedLinks.has(curUrl.toString())) {
      return;
    }

    console.debug(`Crawling page: ${curUrl.toString()}`);

    await page.goto(curUrl.toString());

    const htmlContent = await page.content();
    const linkGroups = await this.getLinkGroupsFromPage(page, curUrl);
    const requestCount = curRequestCount + 1;

    visitedLinks.add(curUrl.toString());

    yield {
      path: curUrl.pathname,
      url: curUrl.toString(),
      content: htmlContent,
    };

    for (const linkGroup of linkGroups) {
      for (const link of linkGroup) {
        yield* this.crawlSitePages(
          page,
          new URL(link),
          visitedLinks,
          requestCount,
        );
      }
    }
  }

  private async *crawlSite(): AsyncGenerator<PageData> {
    console.debug(`Crawling site repo: ${this.startUrl}`);

    const stats = await PCR(DocsCrawler.PCR_CONFIG);

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
    } finally {
      await browser.close();
    }
  }
}
