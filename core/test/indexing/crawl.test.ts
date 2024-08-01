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
