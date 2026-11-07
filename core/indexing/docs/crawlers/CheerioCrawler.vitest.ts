import { afterEach, describe, expect, it, vi } from "vitest";
import CheerioCrawler from "./CheerioCrawler";

describe("CheerioCrawler HTML parsing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("follows unique same-host links while retaining the original HTML", async () => {
    const html = `<html><body>
      <a href="./guide?lang=en&amp;version=1">Guide</a>
      <a href="/docs/guide">Duplicate guide</a>
      <a href="https://other.example/">External</a>
      <a href="/search.html">Search</a>
      <a>No link</a>
    </body></html>`;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(html))
      .mockResolvedValueOnce(new Response("<h1>Guide</h1>"));
    vi.stubGlobal("fetch", fetch);

    const pages = [];
    for await (const page of new CheerioCrawler(
      new URL("https://docs.example/docs/"),
      10,
      1,
    ).crawl()) {
      pages.push(page);
    }

    expect(pages.map(({ path }) => path)).toEqual(["/docs/", "/docs/guide"]);
    expect(pages[0].content).toBe(html);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://docs.example/docs/",
      "https://docs.example/docs/guide",
    ]);
  });
});
