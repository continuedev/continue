import { afterEach, describe, expect, it, vi } from "vitest";

import { GeminiApi } from "./Gemini.js";

// Mock the fetch package so the embeddings test can stub the HTTP response.
vi.mock("@continuedev/fetch", async () => {
  const actual = await vi.importActual("@continuedev/fetch");
  return {
    ...actual,
    fetchwithRequestOptions: vi.fn(),
  };
});

describe("GeminiApi", () => {
  const api = new GeminiApi({
    provider: "gemini",
    apiKey: "test-key",
  });

  describe("_convertBody merges consecutive same-role messages", () => {
    it("merges consecutive tool responses into a single user turn", () => {
      const result = api._convertBody(
        {
          model: "gemini-2.5-flash",
          messages: [
            { role: "user", content: "Use the tools" },
            {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function" as const,
                  function: { name: "tool_a", arguments: "{}" },
                },
                {
                  id: "call_2",
                  type: "function" as const,
                  function: { name: "tool_b", arguments: "{}" },
                },
              ],
            },
            {
              role: "tool" as const,
              content: "result_a",
              tool_call_id: "call_1",
            },
            {
              role: "tool" as const,
              content: "result_b",
              tool_call_id: "call_2",
            },
          ],
        },
        false,
        true,
      );

      // Should be: user, model(functionCalls), user(functionResponses merged)
      expect(result.contents).toHaveLength(3);
      expect(result.contents[0].role).toBe("user");
      expect(result.contents[1].role).toBe("model");
      expect(result.contents[2].role).toBe("user");
      // Both function responses merged into one user turn
      expect(result.contents[2].parts).toHaveLength(2);
      expect(result.contents[2].parts[0]).toHaveProperty("functionResponse");
      expect(result.contents[2].parts[1]).toHaveProperty("functionResponse");
    });

    it("merges tool responses with following user message", () => {
      const result = api._convertBody(
        {
          model: "gemini-2.5-flash",
          messages: [
            { role: "user", content: "Use the tool" },
            {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function" as const,
                  function: { name: "tool_a", arguments: "{}" },
                },
              ],
            },
            {
              role: "tool" as const,
              content: "result_a",
              tool_call_id: "call_1",
            },
            { role: "user", content: "Now do something else" },
          ],
        },
        false,
        true,
      );

      // tool response (user) + user message should merge
      expect(result.contents).toHaveLength(3);
      expect(result.contents[2].role).toBe("user");
      expect(result.contents[2].parts).toHaveLength(2);
    });

    it("merges consecutive model messages", () => {
      const result = api._convertBody(
        {
          model: "gemini-2.5-flash",
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "First response" },
            { role: "assistant", content: "Second response" },
          ],
        },
        false,
        true,
      );

      // Two assistant messages should merge into one model message
      expect(result.contents).toHaveLength(2);
      expect(result.contents[1].role).toBe("model");
      expect(result.contents[1].parts).toHaveLength(2);
    });

    it("preserves already-alternating messages unchanged", () => {
      const result = api._convertBody(
        {
          model: "gemini-2.5-flash",
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there" },
            { role: "user", content: "How are you?" },
          ],
        },
        false,
        true,
      );

      expect(result.contents).toHaveLength(3);
      expect(result.contents[0].role).toBe("user");
      expect(result.contents[1].role).toBe("model");
      expect(result.contents[2].role).toBe("user");
    });
  });

  describe("embed", () => {
    afterEach(() => {
      vi.clearAllMocks();
      vi.unstubAllGlobals();
    });

    it("parses the 'embeddings' field from the batchEmbedContents response", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            embeddings: [
              { values: [0.1, 0.2, 0.3] },
              { values: [0.4, 0.5, 0.6] },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);
      const fetchPackage = await import("@continuedev/fetch");
      vi.mocked(fetchPackage.fetchwithRequestOptions).mockImplementation(
        mockFetch as any,
      );

      const response = await api.embed({
        model: "gemini-embedding-001",
        input: ["Hello", "World"],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url.toString()).toContain(":batchEmbedContents");
      expect(response.data.map((d) => d.embedding)).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
    });
  });
});
