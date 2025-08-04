import { ToolExtras } from "../..";
import { searchContinueDocsImpl } from "./searchContinueDocs";

// Mock TrieveSDK
const mockAutocomplete = jest.fn();
jest.mock("trieve-ts-sdk", () => ({
  TrieveSDK: jest.fn().mockImplementation(() => ({
    autocomplete: mockAutocomplete,
  })),
}));

// Mock fetch for config
global.fetch = jest.fn();

const mockExtras = {
  fetch: jest.fn() as any,
  ide: {} as any,
} as unknown as ToolExtras;

beforeEach(() => {
  jest.clearAllMocks();
});

it("searchContinueDocs should return search results for valid query", async () => {
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
  (fetch as any).mockResolvedValueOnce({
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
});

it("searchContinueDocs should return error when config fetch fails", async () => {
  (fetch as any).mockResolvedValueOnce({
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
});

it("searchContinueDocs should return error when search returns no results", async () => {
  const mockConfig = {
    trieveApiKey: "test-api-key",
    trieveDatasetId: "test-dataset-id",
    name: "Continue Documentation",
  };

  const mockSearchResponse = {
    chunks: [],
  };

  // Mock the config fetch
  (fetch as any).mockResolvedValueOnce({
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
});
