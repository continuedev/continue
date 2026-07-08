import { expect, test, vi } from "vitest";
import { fetchUrlContentImpl } from "./fetchUrlContent";

vi.mock("../../context/providers/URLContextProvider", () => ({
  getUrlContextItems: vi.fn(),
}));

import { ToolExtras } from "../..";
import { getUrlContextItems } from "../../context/providers/URLContextProvider";
const mockExtras = {
  fetch: vi.fn() as any,
  ide: {} as any,
} as unknown as ToolExtras;

test("fetchUrlContent should not truncate content under character limit", async () => {
  const shortContent = "This is a short content";
  const mockContextItems = [
    {
      name: "Test URL",
      description: "Test URL description",
      content: shortContent,
    },
  ];

  (getUrlContextItems as any).mockResolvedValue(mockContextItems);

  const result = await fetchUrlContentImpl(
    { url: "https://example.com" },
    mockExtras,
  );

  expect(result).toHaveLength(1);
  expect(result[0].content).toBe(shortContent);
});

test("fetchUrlContent should truncate content exceeding character limit", async () => {
  const DEFAULT_FETCH_URL_CHAR_LIMIT = 20000;
  // Create a string exceeding the character limit
  const longContent = "a".repeat(DEFAULT_FETCH_URL_CHAR_LIMIT + 1000);
  const mockContextItems = [
    {
      name: "Test URL",
      description: "Test URL description",
      content: longContent,
    },
  ];

  (getUrlContextItems as any).mockResolvedValue(mockContextItems);

  const result = await fetchUrlContentImpl(
    { url: "https://example.com" },
    mockExtras,
  );

  expect(result).toHaveLength(2); // Original item + warning
  expect(result[0].content.length).toBe(DEFAULT_FETCH_URL_CHAR_LIMIT);
  expect(result[1].name).toBe("Truncation warning");
  expect(result[1].content).toContain("was truncated");
  expect(result[1].content).toContain("20000 character limit");
});

test("fetchUrlContent should add truncation warning with multiple truncated items", async () => {
  const DEFAULT_FETCH_URL_CHAR_LIMIT = 20000;
  // Create strings exceeding the character limit
  const longContent1 = "a".repeat(DEFAULT_FETCH_URL_CHAR_LIMIT + 500);
  const longContent2 = "b".repeat(DEFAULT_FETCH_URL_CHAR_LIMIT + 1000);
  const mockContextItems = [
    {
      name: "Test URL 1",
      description: "Test URL description 1",
      content: longContent1,
    },
    {
      name: "Test URL 2",
      description: "Test URL description 2",
      content: longContent2,
    },
  ];

  (getUrlContextItems as any).mockResolvedValue(mockContextItems);

  const result = await fetchUrlContentImpl(
    { url: "https://example.com" },
    mockExtras,
  );

  expect(result).toHaveLength(3); // Two original items + warning
  expect(result[0].content.length).toBe(DEFAULT_FETCH_URL_CHAR_LIMIT);
  expect(result[1].content.length).toBe(DEFAULT_FETCH_URL_CHAR_LIMIT);
  expect(result[2].name).toBe("Truncation warning");
});

test("fetchUrlContent should propagate errors when URL fetch fails", async () => {
  const errorMessage = "HTTP 404 Not Found";

  (getUrlContextItems as any).mockRejectedValue(new Error(errorMessage));

  await expect(
    fetchUrlContentImpl({ url: "https://example.com/404" }, mockExtras),
  ).rejects.toThrow(errorMessage);
});
