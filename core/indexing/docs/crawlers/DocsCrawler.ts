import { URL } from "node:url";

import { ContinueConfig, IDE } from "../../..";

import CheerioCrawler from "./CheerioCrawler";
import { ChromiumCrawler, ChromiumInstaller } from "./ChromiumCrawler";
import { DefaultCrawler } from "./DefaultCrawler";
import GitHubCrawler from "./GitHubCrawler";

export type PageData = {
  url: string;
  path: string;
  content: string;
};

export type DocsCrawlerType = "default" | "cheerio" | "chromium" | "github";

class DocsCrawler {
  private readonly GITHUB_HOST = "github.com";
  private readonly chromiumInstaller: ChromiumInstaller;

  constructor(
    private readonly ide: IDE,
    private readonly config: ContinueConfig,
    private readonly maxDepth: number = 4,
    private readonly maxRequestsPerCrawl: number = 1000,
    private readonly useLocalCrawling: boolean = false,
    private readonly githubToken: string | undefined = undefined,
  ) {
    this.chromiumInstaller = new ChromiumInstaller(this.ide, this.config);
  }

  private shouldUseChromium() {
    return (
      this.config.experimental?.useChromiumForDocsCrawling &&
      this.chromiumInstaller.isInstalled()
    );
  }

  /*
    Returns the type of crawler used in the end
  */
  async *crawl(
    startUrl: URL,
  ): AsyncGenerator<PageData, DocsCrawlerType, undefined> {
    if (startUrl.host === this.GITHUB_HOST) {
      yield* new GitHubCrawler(startUrl, this.githubToken).crawl();
      return "github";
    }

    if (!this.useLocalCrawling) {
      try {
        const pageData = await new DefaultCrawler(
          startUrl,
          this.maxRequestsPerCrawl,
          this.maxDepth,
        ).crawl();
        if (pageData.length > 0) {
          yield* pageData;
          return "default";
        }
      } catch (e) {
        console.error("Default crawler failed, trying backup: ", e);
      }
    }

    if (this.shouldUseChromium()) {
      yield* new ChromiumCrawler(
        startUrl,
        this.maxRequestsPerCrawl,
        this.maxDepth,
      ).crawl();
      return "chromium";
    } else {
      let didCrawlSinglePage = false;

      for await (const pageData of new CheerioCrawler(
        startUrl,
        this.maxRequestsPerCrawl,
        this.maxDepth,
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
          void this.ide.showToast(
            "info",
            `Successfully installed Chromium! Retrying crawl of: ${startUrl.toString()}`,
          );

          yield* new ChromiumCrawler(
            startUrl,
            this.maxRequestsPerCrawl,
            this.maxDepth,
          ).crawl();
          return "chromium";
        }
      }

      return "cheerio";
    }
  }
}

export default DocsCrawler;
export { CheerioCrawler, ChromiumCrawler, ChromiumInstaller, GitHubCrawler };
