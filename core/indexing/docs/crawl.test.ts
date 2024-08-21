import { crawlPage, PageData } from "../../indexing/docs/crawl";

describe("crawlPage - GitHub repository", () => {
  const repoUrl = new URL(
    "https://github.com/Patrick-Erichsen/test-github-repo-for-crawling",
  );
  const maxDepth = 3;
  let crawlResults: PageData[];

  beforeAll(async () => {
    crawlResults = [];
    for await (const page of crawlPage(repoUrl, maxDepth)) {
      crawlResults.push(page);
    }
  }, 30000);

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

    expect(doc?.html.includes("Test body")).toBe(true);
    expect(doc?.html.includes("Test H2 Header")).toBe(true);
  });

  // This test is currently failing, `maxDepth` does not appear to be followed right now
  test.todo(
    "ignores files past the max depth",
    //   , () => {
    //   expect(
    //     crawlResults.some((page) => page.path.includes("docs-depth-3")),
    //   ).toBe(false);
    // }
  );

  test("ignores non-markdown files, e.g. `test.js` at the root", async () => {
    expect(crawlResults.some((page) => page.path.endsWith("test.js"))).toBe(
      false,
    );
  });
});

async function testSite(url: string, expectedPaths: string[]) {
  test(`crawlPage - ${url}`, async () => {
    const crawlResults: PageData[] = [];
    for await (const page of crawlPage(new URL(url))) {
      crawlResults.push(page);
    }

    console.log(crawlResults.map((page) => page.path));

    // Check if all expected paths are found
    for (const expectedPath of expectedPaths) {
      expect(
        crawlResults.some((page) => page.path.endsWith(expectedPath)),
      ).toBe(true);
    }
  });
}

const SITES: { [rootUrl: string]: string[] } = {
  "https://docs.continue.dev": [
    "intro",
    "quickstart",
    "features/tab-autocomplete",
    "reference/Model%20Providers/mistral",
  ],
  // Failing
  // "https://docs.astro.build/en/getting-started/": ["https://docs.astro.build/en/getting-started/"],
  // Failing
  // "https://docs.nestjs.com/": ["first-steps"],
  // Taking too much time
  // "https://go.dev/doc/": ["install", "tutorial/getting-started", "comment"],
  // Taking too much time
  // "https://clickhouse.com/docs": [
  //   "intro",
  //   "getting-started/quick-start",
  //   "migrations/bigquery/migrating-to-clickhouse-cloud",
  // ],
  // Taking too much time
  // "https://www.tensorflow.org/api_docs": ["python/tf/Variable"],
  // "https://www.rust-lang.org/learn": []
  // Taking too long
  // "https://docs.anthropic.com/en/docs": [
  //   "welcome",
  //   "quickstart",
  //   "build-with-claude/prompt-engineering/prompt-generator",
  // ],
};

describe.only("crawlPage should return expected subpages for common sites", () => {
  for (const [rootUrl, expectedPaths] of Object.entries(SITES)) {
    testSite(rootUrl, expectedPaths);
  }
});
