import { beforeEach, describe, expect, it } from "vitest";
import { ChatMessage, LLMOptions } from "../index";
import { BaseLLM } from "./index";

/**
 * Mock LLM for testing thinking tag extraction during streaming
 */
class MockStreamingLLM extends BaseLLM {
  static providerName = "mock-streaming";

  private mockChunks: ChatMessage[] = [];

  setMockChunks(chunks: ChatMessage[]) {
    this.mockChunks = chunks;
  }

  async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: any,
  ): AsyncGenerator<string> {
    yield "not used in these tests";
  }

  async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: any,
  ): AsyncGenerator<ChatMessage> {
    for (const chunk of this.mockChunks) {
      yield chunk;
    }
  }
}

describe("ThinkingTagExtractor Integration with BaseLLM", () => {
  let llm: MockStreamingLLM;

  beforeEach(() => {
    const options: LLMOptions = {
      model: "mock-model",
      thinkingOpenTag: "<think>",
      thinkingCloseTag: "</think>",
    };
    llm = new MockStreamingLLM(options);
  });

  describe("streamChat with thinking tags", () => {
    it("should extract thinking content from single chunk", async () => {
      llm.setMockChunks([
        {
          role: "assistant",
          content: "<think>my thinking</think>my response",
        },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        role: "thinking",
        content: "my thinking",
      });
      expect(chunks[1]).toEqual({
        role: "assistant",
        content: "my response",
      });
    });

    it("should handle thinking split across multiple chunks", async () => {
      llm.setMockChunks([
        { role: "assistant", content: "<think>first " },
        { role: "assistant", content: "part</think>answer " },
        { role: "assistant", content: "here" },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      // Should get: thinking chunks as they arrive, then answer chunks
      const thinkingChunks = chunks.filter((c) => c.role === "thinking");
      const assistantChunks = chunks.filter((c) => c.role === "assistant");

      expect(thinkingChunks.length).toBeGreaterThan(0);
      expect(thinkingChunks.map((c) => c.content).join("")).toBe("first part");
      expect(assistantChunks.map((c) => c.content).join("")).toBe(
        "answer here",
      );
    });

    it("should handle partial tags at chunk boundaries", async () => {
      llm.setMockChunks([
        { role: "assistant", content: "before<th" },
        { role: "assistant", content: "ink>thinking</th" },
        { role: "assistant", content: "ink>after" },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      const thinkingChunks = chunks.filter((c) => c.role === "thinking");
      const assistantChunks = chunks.filter((c) => c.role === "assistant");

      expect(thinkingChunks.map((c) => c.content).join("")).toBe("thinking");
      expect(assistantChunks.map((c) => c.content).join("")).toBe(
        "beforeafter",
      );
    });

    it("should flush remaining content at stream end", async () => {
      llm.setMockChunks([
        { role: "assistant", content: "<think>incomplete thinking" },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      // Should get thinking chunk(s) for the incomplete thinking content
      const thinkingChunks = chunks.filter((c) => c.role === "thinking");
      expect(thinkingChunks.length).toBeGreaterThan(0);
      expect(thinkingChunks.map((c) => c.content).join("")).toBe(
        "incomplete thinking",
      );
    });

    it("should handle multiple thinking blocks in stream", async () => {
      llm.setMockChunks([
        { role: "assistant", content: "<think>first</think>text1" },
        { role: "assistant", content: "<think>second</think>text2" },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      const thinkingChunks = chunks.filter((c) => c.role === "thinking");
      const assistantChunks = chunks.filter((c) => c.role === "assistant");

      expect(thinkingChunks.map((c) => c.content).join("")).toBe("firstsecond");
      expect(assistantChunks.map((c) => c.content).join("")).toBe("text1text2");
    });

    it("should not emit empty chunks", async () => {
      llm.setMockChunks([
        { role: "assistant", content: "<think>only thinking</think>" },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      // Should only have thinking chunk, no empty assistant chunk
      expect(chunks.every((c) => c.content && c.content.length > 0)).toBe(true);
      expect(chunks.filter((c) => c.role === "thinking")).toHaveLength(1);
      expect(chunks.filter((c) => c.role === "assistant")).toHaveLength(0);
    });
  });

  describe("streamChat without thinking tags configured", () => {
    beforeEach(() => {
      // Create LLM without thinking tags
      const options: LLMOptions = {
        model: "mock-model",
      };
      llm = new MockStreamingLLM(options);
    });

    it("should pass through content unchanged when no tags configured", async () => {
      llm.setMockChunks([
        {
          role: "assistant",
          content: "<think>this should not be extracted</think>regular content",
        },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({
        role: "assistant",
        content: "<think>this should not be extracted</think>regular content",
      });
    });
  });

  describe("streamChat with native thinking role chunks", () => {
    it("should handle native thinking role chunks alongside extraction", async () => {
      // Simulate a provider that sends both native thinking role AND tagged content
      llm.setMockChunks([
        { role: "thinking", content: "native thinking" },
        { role: "assistant", content: "<think>tagged thinking</think>answer" },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      const thinkingChunks = chunks.filter((c) => c.role === "thinking");
      const assistantChunks = chunks.filter((c) => c.role === "assistant");

      // Should preserve native thinking chunks and extract tagged thinking
      expect(thinkingChunks.map((c) => c.content).join("")).toBe(
        "native thinkingtagged thinking",
      );
      expect(assistantChunks.map((c) => c.content).join("")).toBe("answer");
    });
  });

  describe("custom tag formats", () => {
    it("should work with custom reasoning tags", async () => {
      const options: LLMOptions = {
        model: "mock-model",
        thinkingOpenTag: "<reasoning>",
        thinkingCloseTag: "</reasoning>",
      };
      llm = new MockStreamingLLM(options);

      llm.setMockChunks([
        {
          role: "assistant",
          content: "<reasoning>my reasoning</reasoning>my answer",
        },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        role: "thinking",
        content: "my reasoning",
      });
      expect(chunks[1]).toEqual({
        role: "assistant",
        content: "my answer",
      });
    });

    it("should work with bracket-style tags", async () => {
      const options: LLMOptions = {
        model: "mock-model",
        thinkingOpenTag: "[THINK]",
        thinkingCloseTag: "[/THINK]",
      };
      llm = new MockStreamingLLM(options);

      llm.setMockChunks([
        {
          role: "assistant",
          content: "[THINK]internal thought[/THINK]response",
        },
      ]);

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "test" }],
        new AbortController().signal,
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        role: "thinking",
        content: "internal thought",
      });
      expect(chunks[1]).toEqual({
        role: "assistant",
        content: "response",
      });
    });
  });
});
