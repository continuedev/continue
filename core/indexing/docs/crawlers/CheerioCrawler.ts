import { URL } from "node:url";

import * as cheerio from "cheerio";

import { PageData } from "./DocsCrawler";

export default class CheerioCrawler {
  private readonly IGNORE_PATHS_ENDING_IN = [
    "favicon.ico",
    "robots.txt",
    ".rst.txt",
    "genindex",
    "py-modindex",
    "search.html",
    "search",
    "genindex.html",
    "changelog",
    "changelog.html",
  ];

  constructor(
    private readonly startUrl: URL,
    private readonly maxRequestsPerCrawl: number,
    private readonly maxDepth: number,
  ) {}

  async *crawl(): AsyncGenerator<PageData> {
    let currentPageCount = 0;
    console.log(
      `[${
        (this.constructor as any).name
      }] Starting crawl from: ${this.startUrl} - Max Depth: ${this.maxDepth}`,
    );

    const { baseUrl, basePath } = this.splitUrl(this.startUrl);

    let paths: { path: string; depth: number }[] = [
      { path: basePath, depth: 0 },
    ];

    let index = 0;

    while (index < paths.length) {
      const batch = paths.slice(index, index + 50);

      try {
        const promises = batch.map(({ path, depth }) =>
          this.getLinksFromUrl(baseUrl, path).then((links) => ({
            links,
            path,
            depth,
          })),
        );

        const results = await Promise.all(promises);
        for (const {
          links: { html, links: linksArray },
          path,
          depth,
        } of results) {
          if (html !== "" && depth <= this.maxDepth) {
            yield { url: this.startUrl.toString(), path, content: html };
            currentPageCount++;
            if (currentPageCount >= this.maxRequestsPerCrawl) {
              console.log("Crawl completed - max requests reached");
              return;
            }
          }

          if (depth < this.maxDepth) {
            for (let link of linksArray) {
              if (!paths.some((p) => p.path === link)) {
                paths.push({ path: link, depth: depth + 1 });
              }
            }
          }
        }
      } catch (e) {
        console.debug("Error while crawling page: ", e);
      }

      index += batch.length;
    }

    console.log("Crawl completed");
  }

  private async getLinksFromUrl(url: string, path: string) {
    const baseUrl = new URL(url);
    const location = new URL(path, url);
    let response;

    try {
      response = await fetch(location.toString());
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("maximum redirect")
      ) {
        console.error(
          `[${
            (this.constructor as any).name
          }] Maximum redirect reached for: ${location.toString()}`,
        );
        return { html: "", links: [] };
      }
      console.error(error);
      return { html: "", links: [] };
    }
    if (!response.ok) {
      return { html: "", links: [] };
    }
    const html = await response.text();
    let links: string[] = [];

    if (url.includes("github.com")) {
      return { html, links };
    }

    const $ = cheerio.load(html);

    $("a").each((_: any, element: any) => {
      const href = $(element).attr("href");
      if (!href) {
        return;
      }

      const parsedUrl = new URL(href, location);
      if (parsedUrl.hostname === baseUrl.hostname) {
        links.push(parsedUrl.pathname);
      }
    });

    links = [...new Set(links)].filter((link) => {
      return (
        !link.includes("#") &&
        !this.IGNORE_PATHS_ENDING_IN.some((ending) => link.endsWith(ending))
      );
    });
    return { html, links };
  }

  private splitUrl(url: URL) {
    const baseUrl = new URL("/", url).href;
    const basePath = url.pathname;
    return { baseUrl, basePath };
  }
}
