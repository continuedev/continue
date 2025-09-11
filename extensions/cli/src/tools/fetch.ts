import type { ContextItem } from "core/index.js";
import { fetchUrlContentImpl } from "core/tools/implementations/fetchUrlContent.js";

import { Tool } from "./types.js";

export const fetchTool: Tool = {
  name: "Fetch",
  displayName: "Fetch",
  description:
    "Fetches content from a URL, converts to markdown, and handles long content with truncation",
  parameters: {
    url: {
      type: "string",
      description: "The URL to fetch content from",
      required: true,
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
  run: async (args: { url: string }): Promise<string> => {
    const { url } = args;

    try {
      // Suppress console errors from JSDOM CSS parsing
      const originalConsoleError = console.error;
      console.error = () => {};

      // Use the core fetchUrlContent implementation
      const contextItems = await fetchUrlContentImpl({ url }, { fetch });

      // Restore console.error
      console.error = originalConsoleError;

      if (contextItems.length === 0) {
        return `Error: Could not fetch content from ${url}`;
      }

      // Format the results for CLI display
      return contextItems
        .map((item: ContextItem) => {
          if (item.name === "Truncation warning") {
            return item.content;
          }
          return item.content;
        })
        .join("\n\n");
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
