import { describe, expect, it } from "vitest";
import { ThinkingTagExtractor } from "./index";

describe("ThinkingTagExtractor", () => {
  describe("basic functionality", () => {
    it("should extract thinking content with simple tags", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      const result = extractor.process(
        "<think>thinking content</think>regular content",
      );
      expect(result.thinking).toBe("thinking content");
      expect(result.content).toBe("regular content");
    });

    it("should handle content before thinking tags", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      const result = extractor.process("before<think>thinking</think>after");
      expect(result.thinking).toBe("thinking");
      expect(result.content).toBe("beforeafter");
    });

    it("should handle only thinking content", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      const result = extractor.process("<think>only thinking</think>");
      expect(result.thinking).toBe("only thinking");
      expect(result.content).toBe("");
    });

    it("should handle only regular content", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      const result = extractor.process("just regular content");
      expect(result.thinking).toBe("");
      expect(result.content).toBe("just regular content");
    });

    it("should handle multiple thinking blocks", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      const result = extractor.process(
        "<think>first</think>middle<think>second</think>end",
      );
      expect(result.thinking).toBe("firstsecond");
      expect(result.content).toBe("middleend");
    });
  });

  describe("streaming chunks", () => {
    it("should handle thinking content split across chunks", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");

      // Simulate streaming: "<think>thinking content</think>regular content"
      const result1 = extractor.process("<thi");
      expect(result1.thinking).toBe("");
      expect(result1.content).toBe("");

      const result2 = extractor.process("nk>thinking");
      expect(result2.thinking).toBe("thinking");
      expect(result2.content).toBe("");

      const result3 = extractor.process(" content</th");
      expect(result3.thinking).toBe(" content");
      expect(result3.content).toBe("");

      const result4 = extractor.process("ink>regular");
      expect(result4.thinking).toBe("");
      expect(result4.content).toBe("regular");

      const result5 = extractor.process(" content");
      expect(result5.thinking).toBe("");
      expect(result5.content).toBe(" content");
    });

    it("should handle partial open tag at end of chunk", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");

      const result1 = extractor.process("before<th");
      expect(result1.content).toBe("before");
      expect(result1.thinking).toBe("");

      const result2 = extractor.process("ink>thinking</think>");
      expect(result2.thinking).toBe("thinking");
      expect(result2.content).toBe("");
    });

    it("should handle partial close tag at end of chunk", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");

      const result1 = extractor.process("<think>thinking</thi");
      expect(result1.thinking).toBe("thinking");
      expect(result1.content).toBe("");

      const result2 = extractor.process("nk>after");
      expect(result2.thinking).toBe("");
      expect(result2.content).toBe("after");
    });
  });

  describe("flush", () => {
    it("should flush remaining content when not in thinking block", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");

      extractor.process("some content<th");
      const result = extractor.flush();
      expect(result.content).toBe("<th");
      expect(result.thinking).toBe("");
    });

    it("should flush remaining content when in thinking block", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");

      // The thinking content after the open tag is returned in process()
      const processResult = extractor.process("<think>incomplete thinking");
      expect(processResult.thinking).toBe("incomplete thinking");
      expect(processResult.content).toBe("");

      // Flush returns nothing since buffer is empty (all was processed)
      const result = extractor.flush();
      expect(result.thinking).toBe("");
      expect(result.content).toBe("");
    });

    it("should flush remaining partial close tag in thinking block", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");

      // Process some thinking with a partial close tag
      const processResult = extractor.process("<think>thinking</thi");
      expect(processResult.thinking).toBe("thinking");
      expect(processResult.content).toBe("");

      // Flush should return the partial tag as thinking content
      const result = extractor.flush();
      expect(result.thinking).toBe("</thi");
      expect(result.content).toBe("");
    });

    it("should reset state after flush", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");

      extractor.process("<think>thinking");
      extractor.flush();

      const result = extractor.process("new content");
      expect(result.content).toBe("new content");
      expect(result.thinking).toBe("");
    });
  });

  describe("custom tag formats", () => {
    it("should work with vLLM default reasoning tags", () => {
      const extractor = new ThinkingTagExtractor("<reasoning>", "</reasoning>");
      const result = extractor.process(
        "<reasoning>my reasoning</reasoning>answer",
      );
      expect(result.thinking).toBe("my reasoning");
      expect(result.content).toBe("answer");
    });

    it("should work with simple brackets", () => {
      const extractor = new ThinkingTagExtractor("[THINK]", "[/THINK]");
      const result = extractor.process(
        "[THINK]internal thoughts[/THINK]response",
      );
      expect(result.thinking).toBe("internal thoughts");
      expect(result.content).toBe("response");
    });

    it("should work with multi-character tags", () => {
      const extractor = new ThinkingTagExtractor(
        "<<<REASONING>>>",
        "<<<END_REASONING>>>",
      );
      const result = extractor.process(
        "<<<REASONING>>>deep thoughts<<<END_REASONING>>>output",
      );
      expect(result.thinking).toBe("deep thoughts");
      expect(result.content).toBe("output");
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      const result = extractor.process("");
      expect(result.thinking).toBe("");
      expect(result.content).toBe("");
    });

    it("should handle consecutive tags", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      const result = extractor.process("<think></think><think>second</think>");
      expect(result.thinking).toBe("second");
      expect(result.content).toBe("");
    });

    it("should handle nested-like content (not actual nesting)", () => {
      const extractor = new ThinkingTagExtractor("<think>", "</think>");
      // Tags don't actually nest, so inner <think> is just content
      const result = extractor.process(
        "<think>outer <think> inner</think> after</think>",
      );
      // First </think> closes the block
      expect(result.thinking).toBe("outer <think> inner");
      expect(result.content).toBe(" after</think>");
    });

    it("should handle special characters in tags", () => {
      const extractor = new ThinkingTagExtractor(
        "<!--THINK-->",
        "<!--/THINK-->",
      );
      const result = extractor.process(
        "<!--THINK-->special<!--/THINK-->normal",
      );
      expect(result.thinking).toBe("special");
      expect(result.content).toBe("normal");
    });
  });
});