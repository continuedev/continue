import DocsCrawler, { ChromiumCrawler, type PageData } from "./DocsCrawler";
import preIndexedDocs from "./preIndexedDocs";

// Temporary workaround until we have better caching of Chromium
// download between test runs
const TIMEOUT_MS = 1_000_000_000;

// Skipped until we have a better way to cache Chromium installs
// between tests and in CI
describe.skip("crawl", () => {
  beforeAll(async () => {
    // Make sure we have Chromium pulled down before beginning tests
    await ChromiumCrawler.verifyOrInstallChromium();
  }, TIMEOUT_MS);

  describe("GitHub Crawler", () => {
    const repoUrl =
      "https://github.com/Patrick-Erichsen/test-github-repo-for-crawling";

    let crawlResults: PageData[];

    beforeAll(async () => {
      const docsCrawler = new DocsCrawler(false);

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
    it("Pre-indexed Docs", () => {
      const results: { [url: string]: boolean } = {};
      let totalTests = 0;
      let passedTests = 0;

      Object.keys(preIndexedDocs).forEach((url) => {
        it(
          `Crawl test for ${url}`,
          async () => {
            totalTests++;
            let pageFound = false;

            try {
              const docsCrawler = new DocsCrawler(false);

              for await (const page of docsCrawler.crawl(new URL(url), 1)) {
                if (page.url === url) {
                  pageFound = true;
                  break;
                }
              }
            } catch (error) {
              console.error(`Error crawling ${url}:`, error);
            }

            results[url] = pageFound;
            if (pageFound) {
              passedTests++;
              console.log(`✅ ${url}`);
            } else {
              console.log(`❌ ${url}`);
            }

            expect(pageFound).toBe(true);
          },
          TIMEOUT_MS,
        );
      });
    });

    it(
      "succeeds in crawling a list of common sites",
      async () => {
        const TEST_SITES = [
          "https://docs.nestjs.com/",
          "https://docs.nestjs.com/",
          "https://go.dev/doc/",
          "https://clickhouse.com/docs",
          "https://www.tensorflow.org/api_docs",
          "https://www.rust-lang.org/learn",
          "https://docs.anthropic.com/en/docs",
        ];

        const NUM_PAGES_TO_CRAWL = 10;

        for (const site of TEST_SITES) {
          const crawlResults: PageData[] = [];
          const docsCrawler = new DocsCrawler(false);

          for await (const page of docsCrawler.crawl(
            new URL(site),
            NUM_PAGES_TO_CRAWL,
          )) {
            crawlResults.push(page);
          }

          // `toBeGreaterThanOrEqual` because Crawlee doesn't guarantee
          // an exact number of pages to crawl since it runs in parallel
          expect(crawlResults.length).toBeGreaterThanOrEqual(
            NUM_PAGES_TO_CRAWL,
          );
        }
      },
      TIMEOUT_MS,
    );
  });

  describe("Cheerio Crawler", () => {
    it(
      "succeeds in crawling a basic site",
      async () => {
        const NUM_PAGES_TO_CRAWL = 1;
        const site = "https://amplified.dev/";

        const crawlResults: PageData[] = [];
        const docsCrawler = new DocsCrawler(false);

        for await (const page of docsCrawler.crawl(
          new URL(site),
          NUM_PAGES_TO_CRAWL,
        )) {
          crawlResults.push(page);
        }

        expect(crawlResults.length).toBeGreaterThanOrEqual(NUM_PAGES_TO_CRAWL);
      },
      TIMEOUT_MS,
    );
  });
});
