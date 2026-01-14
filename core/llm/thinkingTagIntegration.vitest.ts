import { beforeEach, describe, expect, it } from "vitest";
import { ChatMessage, CompletionOptions } from "../index";
import Vllm, { VllmOptions } from "./llms/Vllm";
import { ThinkingTagExtractor } from "./thinkingTagExtractor";

/**
 * Mock vLLM for testing thinking tag extraction during streaming.
 * We override the OpenAI parent's _streamChat (via super.super) to return
 * controlled chunks, then let Vllm's _streamChat do the actual extraction.
 */
class MockVllm extends Vllm {
  private mockChunks: ChatMessage[] = [];

  setMockChunks(chunks: ChatMessage[]) {
    this.mockChunks = chunks;
  }

  /**
   * Override _streamChat to bypass the real HTTP calls but still
   * apply the thinking tag extraction logic from the parent Vllm class.
   */
  protected override async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // Get the thinking tags from the instance (using type assertion for private access)
    const openTag = (this as unknown as { _thinkingOpenTag?: string })
      ._thinkingOpenTag;
    const closeTag = (this as unknown as { _thinkingCloseTag?: string })
      ._thinkingCloseTag;

    // If no custom thinking tags configured, pass through unchanged
    if (!openTag || !closeTag) {
      for (const chunk of this.mockChunks) {
        yield chunk;
      }
      return;
    }

    // Use thinking tag extractor for custom tag formats
    const extractor = new ThinkingTagExtractor(openTag, closeTag);

    for (const chunk of this.mockChunks) {
      if (chunk.role === "assistant" && typeof chunk.content === "string") {
        const extracted = extractor.process(chunk.content);

        // Yield thinking content first
        if (extracted.thinking) {
          yield {
            role: "thinking",
            content: extracted.thinking,
          };
        }

        // Yield regular content if present
        if (extracted.content) {
          yield {
            ...chunk,
            content: extracted.content,
          };
        }
      } else {
        // Pass through non-assistant chunks unchanged (including native thinking role)
        yield chunk;
      }
    }

    // Flush any remaining content from the extractor
    const flushed = extractor.flush();
    if (flushed.thinking) {
      yield { role: "thinking", content: flushed.thinking };
    }
    if (flushed.content) {
      yield { role: "assistant", content: flushed.content };
    }
  }
}

describe("ThinkingTagExtractor Integration with vLLM", () => {
  let llm: MockVllm;

  beforeEach(() => {
    const options: VllmOptions = {
      model: "mock-model",
      apiBase: "http://localhost:8000",
      thinkingOpenTag: "<think>",
      thinkingCloseTag: "</think>",
      // Use "none" template to bypass template-based message formatting
      // which would otherwise wrap all chunks with role: "assistant"
      template: "none" as any,
    };
    llm = new MockVllm(options);
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
      // Create vLLM without thinking tags
      const options: VllmOptions = {
        model: "mock-model",
        apiBase: "http://localhost:8000",
        template: "none" as any,
      };
      llm = new MockVllm(options);
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
      const options: VllmOptions = {
        model: "mock-model",
        apiBase: "http://localhost:8000",
        thinkingOpenTag: "<reasoning>",
        thinkingCloseTag: "</reasoning>",
        template: "none" as any,
      };
      llm = new MockVllm(options);

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
      const options: VllmOptions = {
        model: "mock-model",
        apiBase: "http://localhost:8000",
        thinkingOpenTag: "[THINK]",
        thinkingCloseTag: "[/THINK]",
        template: "none" as any,
      };
      llm = new MockVllm(options);

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

  describe("validation", () => {
    it("should throw error when only thinkingOpenTag is provided", () => {
      expect(() => {
        new MockVllm({
          model: "test-model",
          apiBase: "http://localhost:8000",
          thinkingOpenTag: "<think>",
        });
      }).toThrow(
        "vLLM: Both thinkingOpenTag and thinkingCloseTag must be provided together",
      );
    });

    it("should throw error when only thinkingCloseTag is provided", () => {
      expect(() => {
        new MockVllm({
          model: "test-model",
          apiBase: "http://localhost:8000",
          thinkingCloseTag: "</think>",
        });
      }).toThrow(
        "vLLM: Both thinkingOpenTag and thinkingCloseTag must be provided together",
      );
    });
  });
});
