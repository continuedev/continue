import os from "os";

import { ContinueConfig } from "../../..";
import { testConfigHandler } from "../../../test/fixtures";
import FileSystemIde from "../../../util/filesystem";

import DocsCrawler, {
  ChromiumInstaller,
  DocsCrawlerType,
  type PageData,
} from "./DocsCrawler";
import { commonDocsSites } from "./crawl-test-cases";

// Temporary workaround until we have better caching of Chromium
// download between test runs
const TIMEOUT_MS = 1_000_000_000;

// Overwrite the Chromium download path to `os.tmpdir()`
// so that we don't delete the Chromium install between tests
ChromiumInstaller.PCR_CONFIG = { downloadPath: os.tmpdir() };

describe("DocsCrawler", () => {
  let config: ContinueConfig;
  let mockIde: FileSystemIde;
  let chromiumInstaller: ChromiumInstaller;
  let docsCrawler: DocsCrawler;

  beforeAll(async () => {
    const result = await testConfigHandler.loadConfig();
    config = result.config!;
    mockIde = new FileSystemIde(process.cwd());
    chromiumInstaller = new ChromiumInstaller(mockIde, config);
    docsCrawler = new DocsCrawler(mockIde, config);
  }, TIMEOUT_MS);

  async function runCrawl(url: string) {
    const pages: PageData[] = [];
    const generator = docsCrawler.crawl(new URL(url));
    let done = false;
    let crawler: DocsCrawlerType = "default";
    while (!done) {
      const result = await generator.next();
      if (result.done) {
        done = true;
        crawler = result.value;
      } else {
        pages.push(result.value);
      }
    }
    return {
      pages,
      crawler,
    };
  }

  describe("GitHub Crawler", () => {
    const repoUrl =
      "https://github.com/Patrick-Erichsen/test-github-repo-for-crawling";

    let crawlResults: PageData[];
    let crawlerUsed: DocsCrawlerType;

    beforeAll(async () => {
      docsCrawler = new DocsCrawler(mockIde, config, 5, 5, false);
      const { pages, crawler } = await runCrawl(repoUrl);
      crawlerUsed = crawler;
      crawlResults = pages;
    }, TIMEOUT_MS);

    test(
      "finds expected markdown files",
      async () => {
        expect(
          crawlResults.some((page) => page.path.endsWith("README.md")),
        ).toBe(true);

        expect(
          crawlResults.some((page) => page.path.endsWith("docs-depth-1.md")),
        ).toBe(true);
      },
      TIMEOUT_MS,
    );

    test(
      "html includes the correct content",
      async () => {
        const doc = crawlResults.find((page) =>
          page.path.endsWith("docs-depth-1.md"),
        );

        expect(doc?.content.includes("Test body")).toBe(true);
        expect(doc?.content.includes("Test H2 Header")).toBe(true);
      },
      TIMEOUT_MS,
    );

    test(
      "ignores non-markdown files, e.g. `test.js` at the root",
      async () => {
        expect(crawlResults.some((page) => page.path.endsWith("test.js"))).toBe(
          false,
        );
      },
      TIMEOUT_MS,
    );
  });

  // Skipped until we have a better way to cache Chromium installs
  // between tests and in CI
  // Run this periodically to make sure it's still working
  describe.skip("Chromium Crawler", () => {
    let shouldUseChromiumSpy: any;

    beforeAll(async () => {
      docsCrawler = new DocsCrawler(mockIde, config, 5, 5, true);
      await chromiumInstaller.install();
      shouldUseChromiumSpy = jest
        .spyOn(docsCrawler as any, "shouldUseChromium")
        .mockReturnValue(true);
    }, TIMEOUT_MS);

    afterAll(() => {
      shouldUseChromiumSpy.mockRestore();
    }, TIMEOUT_MS);

    commonDocsSites.forEach((url) => {
      test(
        `Chromium crawler common site: ${url}`,
        async () => {
          const { pages, crawler } = await runCrawl(url);
          expect(pages.length).toBeGreaterThanOrEqual(1);
          expect(crawler).toEqual("chromium");
        },
        TIMEOUT_MS,
      );
    });
  });

  describe("Default Crawler", () => {
    beforeAll(() => {
      docsCrawler = new DocsCrawler(mockIde, config, 2, 2, false);
    });

    test(
      "works on static site",
      async () => {
        const { pages, crawler } = await runCrawl("https://amplified.dev/");
        expect(pages.length).toBeGreaterThanOrEqual(1);
        expect(crawler).toEqual("default");
      },
      TIMEOUT_MS,
    );

    commonDocsSites.forEach((url) => {
      test(`Default crawler common site: ${url}`, async () => {
        const { pages, crawler } = await runCrawl(url);
        expect(pages.length).toBeGreaterThanOrEqual(1);
        expect(crawler).toEqual("default");
      });
    });
  });

  describe("Cheerio Crawler", () => {
    beforeAll(() => {
      docsCrawler = new DocsCrawler(mockIde, config, 2, 2, true);
    });
    test(
      "works on static site",
      async () => {
        const { pages, crawler } = await runCrawl("https://amplified.dev/");
        expect(pages.length).toBeGreaterThanOrEqual(1);
        expect(crawler).toEqual("cheerio");
      },
      TIMEOUT_MS,
    );
  });
});
