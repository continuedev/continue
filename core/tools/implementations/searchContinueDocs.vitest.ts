import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolExtras } from "../..";

// Mock TrieveSDK using Vitest's better ES module mocking
const mockAutocomplete = vi.fn();
vi.mock("trieve-ts-sdk", () => ({
  TrieveSDK: vi.fn().mockImplementation(() => ({
    autocomplete: mockAutocomplete,
  })),
}));

import { searchContinueDocsImpl } from "./searchContinueDocs";

// Mock fetch for config
const mockFetch = vi.fn();

const mockExtras = {
  fetch: mockFetch,
  ide: {} as any,
} as unknown as ToolExtras;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchContinueDocs", () => {
  it("should return search results for valid query", async () => {
    const mockConfig = {
      trieveApiKey: "test-api-key",
      trieveDatasetId: "test-dataset-id",
      name: "Continue Documentation",
    };

    const mockSearchResponse = {
      chunks: [
        {
          chunk: {
            metadata: { title: "Getting Started" },
            chunk_html: "This is the getting started guide content",
            link: "https://docs.continue.dev/getting-started",
          },
        },
      ],
    };

    // Mock the config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    // Mock TrieveSDK autocomplete
    mockAutocomplete.mockResolvedValue(mockSearchResponse);

    const result = await searchContinueDocsImpl(
      { query: "getting started" },
      mockExtras,
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Search Result 1: Getting Started");
    expect(result[0].description).toBe(
      "Documentation page from Continue docs: Getting Started",
    );
    expect(result[0].content).toContain("Title: Getting Started");
    expect(result[0].content).toContain(
      "This is the getting started guide content",
    );
    expect(result[0].content).toContain(
      "https://docs.continue.dev/getting-started",
    );

    // Verify mocks were called correctly
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
    expect(mockAutocomplete).toHaveBeenCalledWith({
      page_size: 10,
      query: "getting started",
      search_type: "fulltext",
      extend_results: true,
      score_threshold: 1,
    });
  });

  it("should return error when config fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const result = await searchContinueDocsImpl(
      { query: "test query" },
      mockExtras,
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Search Error");
    expect(result[0].content).toContain("Failed to search Continue docs");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });

  it("should return error when search returns no results", async () => {
    const mockConfig = {
      trieveApiKey: "test-api-key",
      trieveDatasetId: "test-dataset-id",
      name: "Continue Documentation",
    };

    const mockSearchResponse = {
      chunks: [],
    };

    // Mock the config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    // Mock TrieveSDK autocomplete to return empty results
    mockAutocomplete.mockResolvedValue(mockSearchResponse);

    const result = await searchContinueDocsImpl(
      { query: "nonexistent query" },
      mockExtras,
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Search Error");
    expect(result[0].content).toContain("No results found");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
  });

  it("should handle TrieveSDK throwing an error", async () => {
    const mockConfig = {
      trieveApiKey: "test-api-key",
      trieveDatasetId: "test-dataset-id",
      name: "Continue Documentation",
    };

    // Mock the config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    // Mock TrieveSDK autocomplete to throw an error
    mockAutocomplete.mockRejectedValue(new Error("API connection failed"));

    const result = await searchContinueDocsImpl(
      { query: "test query" },
      mockExtras,
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Search Error");
    expect(result[0].content).toContain("API connection failed");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
  });
});