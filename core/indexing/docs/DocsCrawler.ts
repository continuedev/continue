import { URL } from "node:url";

// @ts-ignore
// @prettier-ignore
import { ContinueConfig, IDE } from "../..";

import CheerioCrawler from "./crawlers/CheerioCrawler";
import { ChromiumCrawler, ChromiumInstaller } from "./crawlers/ChromiumCrawler";
import { DefaultCrawler } from "./crawlers/DefaultCrawler";
import GitHubCrawler from "./crawlers/GitHubCrawler";

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
  ): AsyncGenerator<PageData, undefined, undefined> {
    if (startUrl.host === this.GITHUB_HOST) {
      yield* new GitHubCrawler(startUrl).crawl();
      return;
    }

    try {
      const pageData = await new DefaultCrawler(startUrl).crawl();
      if (pageData.length > 0) {
        yield* pageData;
        return;
      }
    } catch (e) {
      console.error("Default crawler failed, trying backup: ", e);
    }

    if (this.shouldUseChromium()) {
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
          void this.ide.showToast(
            "info",
            `Successfully installed Chromium! Retrying crawl of: ${startUrl.toString()}`,
          );

          yield* new ChromiumCrawler(startUrl, maxRequestsPerCrawl).crawl();
        }
      }
    }
  }
}

export default DocsCrawler;
export {
  CheerioCrawler,
  ChromiumCrawler,
  ChromiumInstaller,
  GitHubCrawler,
};
