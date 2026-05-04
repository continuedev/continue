/**
 * WebSearchTool — search the web using DuckDuckGo's free search API.
 *
 * Adapted from Marcel's WebSearchTool for the Continue CLI.
 * Uses DuckDuckGo Instant Answer API (no key required) for a basic
 * search, then fetches top result pages for deeper content.
 *
 * Provider-agnostic — works with any LLM backend.
 */

import { fetchUrlContentImpl } from "core/tools/implementations/fetchUrlContent.js";

import { truncateOutputFromEnd } from "../util/truncateOutput.js";

import { Tool } from "./types.js";

const MAX_RESULTS = 5;
const MAX_CHARS_PER_RESULT = 3000;
const DDGS_API = "https://api.duckduckgo.com/";

interface DdgResult {
  title: string;
  url: string;
  snippet: string;
}

async function duckDuckGoSearch(query: string): Promise<DdgResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    no_html: "1",
    skip_disambig: "1",
    no_redirect: "1",
  });

  const url = `${DDGS_API}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "continue-cli/1.0 (search)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const results: DdgResult[] = [];

  // RelatedTopics contains actual search results
  const topics: any[] = data.RelatedTopics ?? [];
  for (const topic of topics.slice(0, MAX_RESULTS)) {
    if (topic.Text && topic.FirstURL) {
      results.push({
        title: topic.Text.split(" - ")[0]?.trim() ?? topic.Text,
        url: topic.FirstURL,
        snippet: topic.Text,
      });
    }
    // Some topics are grouped (Topics array)
    if (topic.Topics) {
      for (const sub of topic.Topics.slice(0, 2)) {
        if (sub.Text && sub.FirstURL) {
          results.push({
            title: sub.Text.split(" - ")[0]?.trim() ?? sub.Text,
            url: sub.FirstURL,
            snippet: sub.Text,
          });
        }
      }
    }
    if (results.length >= MAX_RESULTS) break;
  }

  // Also check AbstractURL / Answer for direct results
  if (results.length === 0 && data.AbstractURL && data.AbstractText) {
    results.push({
      title: data.Heading ?? data.AbstractSource ?? "Result",
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  return results.slice(0, MAX_RESULTS);
}

export const webSearchTool: Tool = {
  name: "WebSearch",
  displayName: "Web Search",
  description:
    "Search the web for current information. Returns relevant results with titles, URLs, and snippets. Use for current events, documentation, or any information that may not be in your training data.",
  parameters: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description: "The search query to look up on the web",
      },
      fetch_results: {
        type: "boolean",
        description:
          "Whether to fetch and include page content for the top results (default: false). Set to true for deeper research.",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    return {
      preview: [
        {
          type: "text",
          content: `Searching the web for: ${args.query}`,
        },
      ],
      args,
    };
  },
  run: async (args: {
    query: string;
    fetch_results?: boolean;
  }): Promise<string> => {
    const { query, fetch_results = false } = args;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return "Error: query is required";
    }

    const start = Date.now();

    let results: DdgResult[];
    try {
      results = await duckDuckGoSearch(query.trim());
    } catch (err) {
      return `Web search failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (results.length === 0) {
      return `No results found for: "${query}"\n\nTip: Try a more specific query or use the Fetch tool to retrieve a specific URL.`;
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const lines: string[] = [
      `Web search results for "${query}" (${elapsed}s):`,
      "",
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      lines.push(`${i + 1}. ${r.title}`);
      lines.push(`   URL: ${r.url}`);
      lines.push(`   ${r.snippet}`);
      lines.push("");

      if (fetch_results) {
        try {
          const items = await fetchUrlContentImpl({ url: r.url }, { fetch });
          const content = items.map((it) => it.content).join("\n");
          const { output } = truncateOutputFromEnd(
            content,
            MAX_CHARS_PER_RESULT,
            "page content",
          );
          lines.push(`   Content preview:`);
          lines.push(
            output
              .split("\n")
              .slice(0, 20)
              .map((l) => `   ${l}`)
              .join("\n"),
          );
          lines.push("");
        } catch {
          // Non-fatal: skip content if fetch fails
        }
      }
    }

    return lines.join("\n");
  },
};
