import DocsCrawler, { type PageData } from "./DocsCrawler";
import preIndexedDocs from "./preIndexedDocs";

// Temporary workaround until we have better caching of Chromium
// download between test runs
const TIMEOUT = 1_000_000;

// Skipped until we have a better way to cache Chromium installs
// between tests and in CI
describe.skip("crawl", () => {
  describe("GitHub repositories", () => {
    const repoUrl =
      "https://github.com/Patrick-Erichsen/test-github-repo-for-crawling";

    let crawlResults: PageData[];

    beforeAll(async () => {
      const docsCrawler = new DocsCrawler(new URL(repoUrl));

      crawlResults = [];

      for await (const page of docsCrawler.crawl()) {
        crawlResults.push(page);
      }
    }, TIMEOUT);

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

  describe.only("Non-Github repository sites", () => {
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
          const docsCrawler = new DocsCrawler(
            new URL(site),
            NUM_PAGES_TO_CRAWL,
          );

          for await (const page of docsCrawler.crawl()) {
            crawlResults.push(page);
          }

          // `toBeGreaterThanOrEqual` because Crawlee doesn't guarantee
          // an exact number of pages to crawl since it runs in parallel
          expect(crawlResults.length).toBeGreaterThanOrEqual(
            NUM_PAGES_TO_CRAWL,
          );
        }
      },
      TIMEOUT,
    );
  });

  describe("Pre-indexed Docs", () => {
    const results: { [url: string]: boolean } = {};
    let totalTests = 0;
    let passedTests = 0;

    Object.keys(preIndexedDocs).forEach((url) => {
      test(
        `Crawl test for ${url}`,
        async () => {
          totalTests++;
          let pageFound = false;

          try {
            const docsCrawler = new DocsCrawler(new URL(url), 1);

            for await (const page of docsCrawler.crawl()) {
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
        TIMEOUT,
      );
    });
  });
});
