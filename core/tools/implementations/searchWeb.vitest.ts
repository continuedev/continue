import { expect, test, vi } from "vitest";
import { searchWebImpl } from "./searchWeb";

// Mock the fetchSearchResults function
vi.mock("../../context/providers/WebContextProvider", () => ({
  fetchSearchResults: vi.fn(),
}));
const mockExtras = {
  fetch: vi.fn() as any,
  ide: {} as any,
} as unknown as ToolExtras;

import { ToolExtras } from "../..";
import { fetchSearchResults } from "../../context/providers/WebContextProvider";

test("searchWeb should not truncate results under character limit", async () => {
  const shortContent = "This is a short search result content";
  const mockSearchResults = [
    {
      name: "Result 1",
      description: "Search result description 1",
      content: shortContent,
    },
    {
      name: "Result 2",
      description: "Search result description 2",
      content: shortContent,
    },
  ];

  (fetchSearchResults as any).mockResolvedValue(mockSearchResults);

  const result = await searchWebImpl({ query: "test query" }, mockExtras);

  expect(result).toHaveLength(2);
  expect(result[0].content).toBe(shortContent);
  expect(result[1].content).toBe(shortContent);
});

test("searchWeb should truncate results exceeding character limit", async () => {
  const DEFAULT_WEB_SEARCH_CHAR_LIMIT = 8000;
  // Create a string exceeding the character limit
  const longContent = "a".repeat(DEFAULT_WEB_SEARCH_CHAR_LIMIT + 1000);
  const shortContent = "This is a short search result content";
  const mockSearchResults = [
    {
      name: "Result 1",
      description: "Search result description 1",
      content: longContent,
    },
    {
      name: "Result 2",
      description: "Search result description 2",
      content: shortContent,
    },
  ];

  (fetchSearchResults as any).mockResolvedValue(mockSearchResults);

  const result = await searchWebImpl({ query: "test query" }, mockExtras);

  expect(result).toHaveLength(3); // Two results + warning
  expect(result[0].content.length).toBe(DEFAULT_WEB_SEARCH_CHAR_LIMIT);
  expect(result[1].content).toBe(shortContent);
  expect(result[2].name).toBe("Truncation warning");
  expect(result[2].content).toContain("truncated");
  expect(result[2].content).toContain("Result 1");
  expect(result[2].content).not.toContain("Result 2");
});

test("searchWeb should include all truncated results in the warning", async () => {
  const DEFAULT_WEB_SEARCH_CHAR_LIMIT = 8000;
  // Create strings exceeding the character limit
  const longContent1 = "a".repeat(DEFAULT_WEB_SEARCH_CHAR_LIMIT + 500);
  const longContent2 = "b".repeat(DEFAULT_WEB_SEARCH_CHAR_LIMIT + 1000);
  const shortContent = "This is a short search result content";
  const mockSearchResults = [
    {
      name: "Result 1",
      description: "Search result description 1",
      content: longContent1,
    },
    {
      name: "Result 2",
      description: "Search result description 2",
      content: longContent2,
    },
    {
      name: "Result 3",
      description: "Search result description 3",
      content: shortContent,
    },
  ];

  (fetchSearchResults as any).mockResolvedValue(mockSearchResults);

  const result = await searchWebImpl({ query: "test query" }, mockExtras);

  expect(result).toHaveLength(4); // Three results + warning
  expect(result[0].content.length).toBe(DEFAULT_WEB_SEARCH_CHAR_LIMIT);
  expect(result[1].content.length).toBe(DEFAULT_WEB_SEARCH_CHAR_LIMIT);
  expect(result[2].content).toBe(shortContent);
  expect(result[3].name).toBe("Truncation warning");
  expect(result[3].content).toContain("Result 1");
  expect(result[3].content).toContain("Result 2");
  expect(result[3].content).not.toContain("Result 3");
});
