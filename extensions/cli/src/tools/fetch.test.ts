import type { ContextItem } from "core/index.js";
import { fetchUrlContentImpl } from "core/tools/implementations/fetchUrlContent.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTool } from "./fetch.js";

// Mock the core fetchUrlContent implementation
vi.mock("core/tools/implementations/fetchUrlContent.js", () => ({
  fetchUrlContentImpl: vi.fn(),
}));

const mockFetchUrlContentImpl = vi.mocked(fetchUrlContentImpl);

describe("fetchTool", () => {
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = vi.fn();
    mockFetchUrlContentImpl.mockReset();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("should return clean content from successful fetch", async () => {
    const mockContextItems: ContextItem[] = [
      {
        name: "Example Page",
        description: "https://example.com",
        content:
          "# Example Page\n\nThis is some example content from a webpage.",
        uri: { type: "url", value: "https://example.com" },
      },
    ];

    mockFetchUrlContentImpl.mockResolvedValue(mockContextItems);

    const result = await fetchTool.run({ url: "https://example.com" });

    expect(result).toBe(
      "# Example Page\n\nThis is some example content from a webpage.",
    );
    expect(mockFetchUrlContentImpl).toHaveBeenCalledWith(
      { url: "https://example.com" },
      { fetch },
    );
  });

  it("should filter out truncation warnings from core implementation", async () => {
    const mockContextItems: ContextItem[] = [
      {
        name: "Long Page",
        description: "https://example.com",
        content: "This is the main content that was truncated.",
        uri: { type: "url", value: "https://example.com" },
      },
      {
        name: "Truncation warning",
        description: "",
        content:
          "The content from https://example.com was truncated because it exceeded the 20000 character limit.",
      },
    ];

    mockFetchUrlContentImpl.mockResolvedValue(mockContextItems);

    const result = await fetchTool.run({ url: "https://example.com" });

    // Truncation warnings are filtered out - only the main content is returned
    expect(result).toBe("This is the main content that was truncated.");
  });

  it("should handle multiple content items", async () => {
    const mockContextItems: ContextItem[] = [
      {
        name: "Page 1",
        description: "https://example.com",
        content: "Content from page 1",
        uri: { type: "url", value: "https://example.com" },
      },
      {
        name: "Page 2",
        description: "https://example.com",
        content: "Content from page 2",
        uri: { type: "url", value: "https://example.com" },
      },
    ];

    mockFetchUrlContentImpl.mockResolvedValue(mockContextItems);

    const result = await fetchTool.run({ url: "https://example.com" });

    expect(result).toBe("Content from page 1\n\nContent from page 2");
  });

  it("should throw error when no content items returned", async () => {
    mockFetchUrlContentImpl.mockResolvedValue([]);

    await expect(fetchTool.run({ url: "https://example.com" })).rejects.toThrow(
      "Could not fetch content from https://example.com",
    );
  });

  it("should throw errors from core implementation", async () => {
    const error = new Error("Network error");
    mockFetchUrlContentImpl.mockRejectedValue(error);

    await expect(fetchTool.run({ url: "https://example.com" })).rejects.toThrow(
      "Error: Network error",
    );
  });

  it("should call fetchUrlContentImpl with correct arguments", async () => {
    const mockContextItems: ContextItem[] = [
      {
        name: "Test Page",
        description: "https://example.com",
        content: "Test content",
        uri: { type: "url", value: "https://example.com" },
      },
    ];

    mockFetchUrlContentImpl.mockResolvedValue(mockContextItems);

    await fetchTool.run({ url: "https://example.com" });

    expect(mockFetchUrlContentImpl).toHaveBeenCalledWith(
      { url: "https://example.com" },
      { fetch },
    );
  });

  it("should have correct tool metadata", () => {
    expect(fetchTool.name).toBe("Fetch");
    expect(fetchTool.displayName).toBe("Fetch");
    expect(fetchTool.description).toBe(
      "Fetches content from a URL, converts to markdown, and handles long content with truncation",
    );
    expect(fetchTool.readonly).toBe(true);
    expect(fetchTool.isBuiltIn).toBe(true);
    expect(fetchTool.parameters).toEqual({
      type: "object",
      required: ["url"],
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch content from",
        },
      },
    });
  });

  it("should provide correct preview in preprocess", async () => {
    const args = { url: "https://example.com" };
    const result = await fetchTool.preprocess?.(args);

    expect(result).toEqual({
      preview: [
        {
          type: "text",
          content: "Will fetch: https://example.com",
        },
      ],
      args,
    });
  });
});
