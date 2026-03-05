import { afterEach, describe, expect, jest, test } from "@jest/globals";
import DeepSeek from "./DeepSeek.js";

describe("DeepSeek Integration Tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should handle abort signal", async () => {
    const deepSeek = new DeepSeek({
      apiKey: "test-api-key",
      model: "deepseek-chat",
      apiBase: "https://api.deepseek.com",
    });

    const abortController = new AbortController();
    
    // Mock fetch that rejects when aborted
    const mockFetch = jest.fn<() => Promise<Response>>();
    mockFetch.mockImplementation(() => {
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });

    (deepSeek as any).fetch = mockFetch;
    (deepSeek as any).useOpenAIAdapterFor = [];

    // Abort immediately
    abortController.abort();

    await expect(
      (deepSeek as any).streamChat(
        [{ role: "user", content: "Hello" }],
        abortController.signal,
      ).next()
    ).rejects.toThrow("Aborted");
  });

  test("should handle API errors gracefully", async () => {
    const deepSeek = new DeepSeek({
      apiKey: "test-api-key",
      model: "deepseek-chat",
      apiBase: "https://api.deepseek.com",
    });

    const mockFetch = jest.fn<() => Promise<Response>>();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    (deepSeek as any).fetch = mockFetch;
    (deepSeek as any).useOpenAIAdapterFor = [];

    const stream = (deepSeek as any).streamChat(
      [{ role: "user", content: "Hello" }],
      new AbortController().signal,
    );

    await expect(stream.next()).rejects.toThrow();
  });
});
