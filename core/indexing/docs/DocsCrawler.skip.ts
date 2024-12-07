import os from "os";

import { jest } from "@jest/globals";

import { ContinueConfig } from "../..";
import { testConfigHandler } from "../../test/fixtures";
import FileSystemIde from "../../util/filesystem";

import DocsCrawler, { ChromiumInstaller, type PageData } from "./DocsCrawler";
import preIndexedDocs from "./preIndexedDocs";

// Temporary workaround until we have better caching of Chromium
// download between test runs
const TIMEOUT_MS = 1_000_000_000;

// Overwrite the Chromium download path to `os.tmpdir()`
// so that we don't delete the Chromium install between tests
ChromiumInstaller.PCR_CONFIG = { downloadPath: os.tmpdir() };

// Skipped until we have a better way to cache Chromium installs
// between tests and in CI
describe.skip("DocsCrawler", () => {
  const NUM_PAGES_TO_CRAWL = 5;

  let config: ContinueConfig;
  let mockIde: FileSystemIde;
  let chromiumInstaller;
  let docsCrawler: DocsCrawler;

  beforeAll(async () => {
    config = await testConfigHandler.loadConfig();
    mockIde = new FileSystemIde(process.cwd());
    chromiumInstaller = new ChromiumInstaller(mockIde, config);
    docsCrawler = new DocsCrawler(mockIde, config);

    // Make sure we have Chromium pulled down before beginning tests
    await chromiumInstaller.install();
  }, TIMEOUT_MS);

  function crawlTest(
    urls: string[],
    numPagesToCrawl: number = NUM_PAGES_TO_CRAWL,
  ) {
    const numUrlsToTest = 5;
    const randomUrls = urls
      .sort(() => 0.5 - Math.random())
      .slice(0, numUrlsToTest);

    randomUrls.forEach((url) => {
      it(
        `Crawl test for ${url}`,
        async () => {
          const crawlResults: PageData[] = [];

          for await (const page of docsCrawler.crawl(
            new URL(url),
            NUM_PAGES_TO_CRAWL,
          )) {
            crawlResults.push(page);
          }

          expect(crawlResults.length).toBeGreaterThanOrEqual(numPagesToCrawl);
        },
        TIMEOUT_MS,
      );
    });
  }

  describe("GitHub Crawler", () => {
    const repoUrl =
      "https://github.com/Patrick-Erichsen/test-github-repo-for-crawling";

    let crawlResults: PageData[];

    beforeAll(async () => {
      crawlResults = [];

      for await (const page of docsCrawler.crawl(new URL(repoUrl))) {
        crawlResults.push(page);
      }
    }, TIMEOUT_MS);

    test("finds expected markdown files", async () => {
      expect(crawlResults.some((page) => page.path.endsWith("README.md"))).toBe(
        true,
      );

      expect(
        crawlResults.some((page) => page.path.endsWith("docs-depth-1.md")),
      ).toBe(true);
    });

    test("html includes the correct content", async () => {
      const doc = crawlResults.find((page) =>
        page.path.endsWith("docs-depth-1.md"),
      );

      expect(doc?.content.includes("Test body")).toBe(true);
      expect(doc?.content.includes("Test H2 Header")).toBe(true);
    });

    test("ignores non-markdown files, e.g. `test.js` at the root", async () => {
      expect(crawlResults.some((page) => page.path.endsWith("test.js"))).toBe(
        false,
      );
    });
  });

  describe("Chromium Crawler", () => {
    let shouldUseChromiumSpy: any;

    beforeAll(() => {
      shouldUseChromiumSpy = jest
        .spyOn(docsCrawler as any, "shouldUseChromium")
        .mockReturnValue(true);
    });

    afterAll(() => {
      shouldUseChromiumSpy.mockRestore();
    });

    describe("Pre-indexed Docs", () => {
      crawlTest(Object.keys(preIndexedDocs));
    });

    describe("Running list of common sites", () => {
      crawlTest([
        "https://docs.nestjs.com/",
        "https://go.dev/doc/",
        "https://clickhouse.com/docs",
        "https://www.tensorflow.org/api_docs",
        // "https://www.rust-lang.org/learn", TODO: This is failing
        "https://docs.anthropic.com/en/docs",
      ]);
    });
  });

  describe("Cheerio Crawler", () => {
    crawlTest(["https://amplified.dev/"], 1);
  });
});
