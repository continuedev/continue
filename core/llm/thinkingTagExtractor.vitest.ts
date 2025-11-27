import { beforeEach, describe, expect, it } from "vitest";
import { ThinkingTagExtractor } from "./thinkingTagExtractor";

/**
 * Unit tests for ThinkingTagExtractor class.
 * These tests verify the thinking tag extraction functionality that is used
 * by vLLM provider for custom thinking output formats.
 */
describe("ThinkingTagExtractor", () => {
  let extractor: ThinkingTagExtractor;

  beforeEach(() => {
    extractor = new ThinkingTagExtractor("<think>", "</think>");
  });

  describe("basic functionality", () => {
    it("should extract thinking content from single text", () => {
      const result = extractor.process("<think>my thinking</think>my response");

      expect(result.thinking).toBe("my thinking");
      expect(result.content).toBe("my response");
    });

    it("should handle text without thinking tags", () => {
      const result = extractor.process("just regular content");

      expect(result.thinking).toBe("");
      expect(result.content).toBe("just regular content");
    });

    it("should handle only thinking content", () => {
      const result = extractor.process("<think>only thinking</think>");

      expect(result.thinking).toBe("only thinking");
      expect(result.content).toBe("");
    });

    it("should handle multiple thinking blocks", () => {
      const result = extractor.process(
        "<think>first</think>text1<think>second</think>text2",
      );

      expect(result.thinking).toBe("firstsecond");
      expect(result.content).toBe("text1text2");
    });
  });

  describe("streaming chunks", () => {
    it("should handle thinking split across multiple chunks", () => {
      const result1 = extractor.process("<think>first ");
      const result2 = extractor.process("part</think>answer ");
      const result3 = extractor.process("here");

      // First chunk starts thinking
      expect(result1.thinking).toBe("first ");
      expect(result1.content).toBe("");

      // Second chunk ends thinking and starts content
      expect(result2.thinking).toBe("part");
      expect(result2.content).toBe("answer ");

      // Third chunk is all content
      expect(result3.thinking).toBe("");
      expect(result3.content).toBe("here");
    });

    it("should handle partial tags at chunk boundaries", () => {
      const result1 = extractor.process("before<th");
      const result2 = extractor.process("ink>thinking</th");
      const result3 = extractor.process("ink>after");

      // Partial tag should be buffered
      expect(result1.thinking).toBe("");
      expect(result1.content).toBe("before");

      // Complete the opening tag, buffer closing tag
      expect(result2.thinking).toBe("thinking");
      expect(result2.content).toBe("");

      // Complete the closing tag
      expect(result3.thinking).toBe("");
      expect(result3.content).toBe("after");
    });

    it("should handle multiple chunks with complete tags", () => {
      const result1 = extractor.process("<think>first</think>text1");
      const result2 = extractor.process("<think>second</think>text2");

      expect(result1.thinking).toBe("first");
      expect(result1.content).toBe("text1");

      expect(result2.thinking).toBe("second");
      expect(result2.content).toBe("text2");
    });
  });

  describe("flush behavior", () => {
    it("should flush remaining content at stream end", () => {
      // Process incomplete thinking
      const result = extractor.process("<think>incomplete thinking");
      expect(result.thinking).toBe("incomplete thinking");
      expect(result.content).toBe("");

      // Flush any remaining buffered content
      const flushed = extractor.flush();
      expect(flushed.thinking).toBe("");
      expect(flushed.content).toBe("");
    });

    it("should flush partial tag as content when outside thinking block", () => {
      // Process content with partial opening tag
      extractor.process("some text<th");

      // Flush should return the partial tag as content
      const flushed = extractor.flush();
      expect(flushed.thinking).toBe("");
      expect(flushed.content).toBe("<th");
    });

    it("should flush partial tag as thinking when inside thinking block", () => {
      // Start thinking block and leave partial closing tag
      extractor.process("<think>thinking content</th");

      // Flush should return the partial tag as thinking
      const flushed = extractor.flush();
      expect(flushed.thinking).toBe("</th");
      expect(flushed.content).toBe("");
    });

    it("should reset state after flush", () => {
      extractor.process("<think>first");
      extractor.flush();

      // After flush, extractor should be reset
      const result = extractor.process("new content");
      expect(result.thinking).toBe("");
      expect(result.content).toBe("new content");
    });
  });

  describe("custom tag formats", () => {
    it("should work with custom reasoning tags", () => {
      const customExtractor = new ThinkingTagExtractor(
        "<reasoning>",
        "</reasoning>",
      );

      const result = customExtractor.process(
        "<reasoning>my reasoning</reasoning>my answer",
      );

      expect(result.thinking).toBe("my reasoning");
      expect(result.content).toBe("my answer");
    });

    it("should work with bracket-style tags", () => {
      const customExtractor = new ThinkingTagExtractor("[THINK]", "[/THINK]");

      const result = customExtractor.process(
        "[THINK]internal thought[/THINK]response",
      );

      expect(result.thinking).toBe("internal thought");
      expect(result.content).toBe("response");
    });

    it("should work with longer custom tags", () => {
      const customExtractor = new ThinkingTagExtractor(
        "<|thinking|>",
        "<|/thinking|>",
      );

      const result = customExtractor.process(
        "<|thinking|>deep thought<|/thinking|>answer",
      );

      expect(result.thinking).toBe("deep thought");
      expect(result.content).toBe("answer");
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      const result = extractor.process("");

      expect(result.thinking).toBe("");
      expect(result.content).toBe("");
    });

    it("should handle nested-looking but not actually nested tags", () => {
      // Not real nesting since the first </think> closes
      const result = extractor.process("<think>outer<think>inner</think>after");

      expect(result.thinking).toBe("outer<think>inner");
      expect(result.content).toBe("after");
    });

    it("should handle content before thinking", () => {
      const result = extractor.process("intro<think>thinking</think>outro");

      expect(result.thinking).toBe("thinking");
      expect(result.content).toBe("introoutro");
    });

    it("should handle special characters in content", () => {
      const result = extractor.process(
        "<think>a < b && c > d</think>result: x < y",
      );

      expect(result.thinking).toBe("a < b && c > d");
      expect(result.content).toBe("result: x < y");
    });

    it("should handle newlines in thinking and content", () => {
      const result = extractor.process(
        "<think>line1\nline2</think>response\nmore",
      );

      expect(result.thinking).toBe("line1\nline2");
      expect(result.content).toBe("response\nmore");
    });
  });
});
