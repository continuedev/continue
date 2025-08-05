import TurndownService from "turndown";

import { Tool } from "./types.js";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
  linkReferenceStyle: "full",
});

// Configure turndown for better markdown output
turndownService.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: function (content) {
    return "~~" + content + "~~";
  },
});

// Handle code blocks better
turndownService.addRule("pre", {
  filter: "pre",
  replacement: function (content, node) {
    const codeEl = node.querySelector("code");
    const language = codeEl?.className.match(/language-(\w+)/)?.[1] || "";
    return "\n\n```" + language + "\n" + content + "\n```\n\n";
  },
});

export const fetchTool: Tool = {
  name: "Fetch",
  displayName: "Fetch",
  description: "Fetches content from a URL and converts it to markdown format",
  parameters: {
    url: {
      type: "string",
      description: "The URL to fetch content from",
      required: true,
    },
    timeout: {
      type: "number",
      description: "Request timeout in milliseconds (default: 10000)",
      required: false,
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    return {
      preview: [
        {
          type: "text",
          content: `Will fetch: ${args.url}`,
        },
      ],
      args,
    };
  },
  run: async (args: { url: string; timeout?: number }): Promise<string> => {
    const { url, timeout = 10000 } = args;

    try {
      // Validate URL
      const urlObj = new URL(url);
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return "Error: Only HTTP and HTTPS URLs are supported";
      }

      // Fetch the content
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Continue-CLI/1.0 (https://continue.dev)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          "Cache-Control": "no-cache",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return `Error: HTTP ${response.status} - ${response.statusText}`;
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle different content types
      if (contentType.includes("application/json")) {
        const json = await response.json();
        return "```json\n" + JSON.stringify(json, null, 2) + "\n```";
      }

      if (contentType.includes("text/plain")) {
        const text = await response.text();
        return text;
      }

      if (!contentType.includes("text/html")) {
        return `Error: Unsupported content type: ${contentType}`;
      }

      // Process HTML content
      const html = await response.text();

      // Convert HTML to markdown
      const markdown = turndownService.turndown(html);

      // Clean up the markdown
      const cleanedMarkdown = markdown
        .replace(/\n\s*\n\s*\n/g, "\n\n") // Remove excessive newlines
        .replace(/^\s+|\s+$/g, "") // Trim whitespace
        .replace(/\\\[/g, "[") // Unescape brackets
        .replace(/\\\]/g, "]");

      return `# Content from ${url}\n\n${cleanedMarkdown}`;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return `Error: Failed to fetch URL "${url}". Please check the URL and try again.`;
      }
      if (error instanceof Error && error.name === "AbortError") {
        return `Error: Request timed out after ${timeout}ms`;
      }
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
