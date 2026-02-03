import { URL } from "node:url";

import { assertLocalhostUrl } from "@continuedev/fetch";
import { getHeaders } from "../../../continueServer/stubs/headers";
import { TRIAL_PROXY_URL } from "../../../control-plane/client";
import { PageData } from "./DocsCrawler";

export class DefaultCrawler {
  constructor(
    private readonly startUrl: URL,
    private readonly maxRequestsPerCrawl: number,
    private readonly maxDepth: number,
  ) {}

  async crawl(): Promise<PageData[]> {
    const crawlUrl = new URL("crawl", TRIAL_PROXY_URL);
    assertLocalhostUrl(crawlUrl, "docs-crawler");
    const resp = await fetch(crawlUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getHeaders()),
      },
      body: JSON.stringify({
        startUrl: this.startUrl.toString(),
        maxDepth: this.maxDepth,
        limit: this.maxRequestsPerCrawl,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to crawl site (${resp.status}): ${text}`);
    }
    const json = (await resp.json()) as PageData[];
    return json;
  }
}
