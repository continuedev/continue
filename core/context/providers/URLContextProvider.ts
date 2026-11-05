import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { NodeHtmlMarkdown } from "node-html-markdown";

import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  FetchFunction,
} from "../../index.js";
import { fetchFavicon } from "../../util/fetchFavicon";
import { resolvesToNonPublic } from "../../util/networkAddress";

class URLContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "url",
    displayTitle: "URL",
    description: "Reference a webpage at a given URL",
    type: "query",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    return await getUrlContextItems(query, extras.fetch);
  }
}

export default URLContextProvider;

const MAX_REDIRECTS = 5;

export interface UrlFetchOptions {
  /**
   * For URLs chosen by the model (the fetch tool) rather than typed by the
   * user: follow redirects one at a time and refuse one that leads from a
   * public address to a non-public one (loopback, private network, the cloud
   * metadata address), and skip the favicon lookup, which would fetch another
   * URL from the page. A URL that is itself non-public is the caller's
   * decision (the tool asks for approval first).
   */
  guardRedirects?: boolean;
}

export async function getUrlContextItems(
  query: string,
  fetchFn: FetchFunction,
  options: UrlFetchOptions = {},
): Promise<ContextItem[]> {
  const url = new URL(query);
  const icon = options.guardRedirects ? undefined : await fetchFavicon(url);
  const resp = options.guardRedirects
    ? await fetchWithGuardedRedirects(url, fetchFn)
    : await fetchFn(url);

  // Check if the response is not OK
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const html = await resp.text();

  const dom = new JSDOM(html);
  let reader = new Readability(dom.window.document);
  let article = reader.parse();
  const content = article?.content || "";
  const markdown = NodeHtmlMarkdown.translate(
    content,
    {},
    undefined,
    undefined,
  );

  const title = article?.title || url.pathname;

  return [
    {
      icon,
      description: url.toString(),
      content: markdown,
      name: title,
      uri: {
        type: "url",
        value: url.toString(),
      },
    },
  ];
}

async function fetchWithGuardedRedirects(
  start: URL,
  fetchFn: FetchFunction,
): Promise<any> {
  const startsNonPublic = await resolvesToNonPublic(start.hostname);
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const resp = await fetchFn(current, { redirect: "manual" });
    const location: string | null | undefined = resp.headers?.get?.("location");
    if (resp.status < 300 || resp.status >= 400 || !location) return resp;

    const next = new URL(location, current);
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      throw new Error(`Refused to follow a redirect to ${next.protocol} URL`);
    }
    if (!startsNonPublic && (await resolvesToNonPublic(next.hostname))) {
      throw new Error(
        `Refused to follow a redirect from ${start.host} to a non-public address (${next.host})`,
      );
    }
    current = next;
  }
  throw new Error(`Too many redirects fetching ${start}`);
}
