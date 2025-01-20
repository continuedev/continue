import { URL } from "node:url";

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
    const resp = await fetch(new URL("crawl", TRIAL_PROXY_URL).toString(), {
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
      throw new Error(`Failed to crawl site: ${text}`);
    }
    const json = (await resp.json()) as PageData[];
    return json;
  }
}
