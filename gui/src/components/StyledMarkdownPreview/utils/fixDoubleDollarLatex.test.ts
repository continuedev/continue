import { fixDoubleDollarNewLineLatex } from "./fixDoubleDollarLatex";

describe("fixDoubleDollarNewLineLatex", () => {
  it("should remove newlines after opening $$ and before closing $$", () => {
    const input = "$$\nE = mc^2\n$$";
    const expected = "$$E = mc^2$$";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });

  it("should handle multi-line latex content", () => {
    const input = "$$\na + b = c\nx = y\n$$";
    const expected = "$$a + b = c\nx = y$$";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });

  it("should not modify inline latex with $$", () => {
    const input = "Here is $$E = mc^2$$ inline";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(input);
  });

  it("should not modify single dollar sign latex", () => {
    const input = "Here is $E = mc^2$ inline";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(input);
  });

  it("should handle text with no latex", () => {
    const input = "This is plain text without any latex";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(input);
  });

  it("should handle multiple latex blocks", () => {
    const input = "Text $$\na = b\n$$ more text $$\nc = d\n$$ end";
    const expected = "Text $$a = b$$ more text $$c = d$$ end";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });

  it("should handle Windows-style line endings (CRLF)", () => {
    const input = "$$\r\nE = mc^2\r\n$$";
    const expected = "$$E = mc^2$$";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });

  it("should handle empty content between $$", () => {
    const input = "$$\n\n$$";
    const expected = "$$$$";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });

  it("should preserve latex without surrounding newlines", () => {
    const input = "Some text $$x^2$$ more text";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(input);
  });

  it("should handle complex latex expressions", () => {
    const input = "$$\n\\frac{a}{b} + \\sqrt{c}\n$$";
    const expected = "$$\\frac{a}{b} + \\sqrt{c}$$";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });

  it("should handle latex with subscripts and superscripts", () => {
    const input = "$$\nx_{i}^{2} + y_{j}^{3}\n$$";
    const expected = "$$x_{i}^{2} + y_{j}^{3}$$";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });

  it("should handle content with special regex characters", () => {
    const input = "$$\na * b + (c)\n$$";
    const expected = "$$a * b + (c)$$";
    expect(fixDoubleDollarNewLineLatex(input)).toBe(expected);
  });
});
