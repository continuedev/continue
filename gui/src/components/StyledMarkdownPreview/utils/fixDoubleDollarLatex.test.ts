import { fixDoubleDollarNewLineLatex } from "./fixDoubleDollarLatex";

describe("fixDoubleDollarNewLineLatex", () => {
  describe("removes newlines from double dollar LaTeX blocks", () => {
    it("should remove newlines from simple LaTeX block", () => {
      const input = "$$\nx^2 + y^2 = z^2\n$$";
      const expected = "$$x^2 + y^2 = z^2$$";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });

    it("should handle LaTeX with multiple lines of content", () => {
      const input = "$$\na + b\nc + d\n$$";
      const expected = "$$a + b\nc + d$$";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });

    it("should handle multiple LaTeX blocks in the same string", () => {
      const input = "$$\nfirst\n$$\ntext\n$$\nsecond\n$$";
      const expected = "$$first$$\ntext\n$$second$$";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });
  });

  describe("preserves text without LaTeX blocks", () => {
    it("should return text unchanged when no LaTeX blocks present", () => {
      const input = "This is regular text without any LaTeX.";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(input);
    });

    it("should preserve inline single dollar LaTeX", () => {
      const input = "This has $inline$ latex";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(input);
    });
  });

  describe("handles edge cases", () => {
    it("should handle empty string", () => {
      expect(fixDoubleDollarNewLineLatex("")).toBe("");
    });

    it("should not modify double dollar LaTeX without newlines", () => {
      const input = "$$x^2$$";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(input);
    });

    it("should handle text before and after LaTeX block", () => {
      const input = "Before text $$\nequation\n$$ after text";
      const expected = "Before text $$equation$$ after text";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });

    it("should handle Windows-style line endings (CRLF)", () => {
      const input = "$$\r\nequation\r\n$$";
      const expected = "$$equation$$";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });

    it("should handle complex mathematical expressions", () => {
      const input = "$$\n\\frac{a}{b} + \\sum_{i=0}^{n} x_i\n$$";
      const expected = "$$\\frac{a}{b} + \\sum_{i=0}^{n} x_i$$";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });
  });

  describe("mixed content", () => {
    it("should handle markdown with embedded LaTeX", () => {
      const input = "# Heading\n\n$$\nmath\n$$\n\nMore text";
      const expected = "# Heading\n\n$$math$$\n\nMore text";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });

    it("should preserve code blocks while fixing LaTeX", () => {
      const input = "```js\ncode\n```\n$$\nlatex\n$$";
      const expected = "```js\ncode\n```\n$$latex$$";
      expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
    });
  });
});
