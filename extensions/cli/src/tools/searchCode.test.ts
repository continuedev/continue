import { smartTruncate, formatTruncationMessage } from './truncation.js';

describe("searchCodeTool truncation logic", () => {
  it("should include truncation message when output exceeds line limit", () => {
    // Create a large sample output (more than 100 lines)
    const largeOutput = Array.from(
      { length: 150 },
      (_, i) => `file${i}.ts:${i}:const foo = 'bar';`,
    ).join("\n");

    // Apply the new smart truncation logic
    const truncationResult = smartTruncate(largeOutput, { maxLines: 100 });
    const truncationMessage = formatTruncationMessage(truncationResult);

    expect(truncationResult.truncated).toBe(true);
    expect(truncationResult.truncatedLineCount).toBe(100);
    expect(truncationResult.originalLineCount).toBe(150);
    expect(truncationMessage).toContain("showing 100 of 150 matches");
  });

  it("should not include truncation message when output is within limits", () => {
    // Create a sample output (less than 100 lines)
    const smallOutput = Array.from(
      { length: 50 },
      (_, i) => `file${i}.ts:${i}:const foo = 'bar';`,
    ).join("\n");

    // Apply the new smart truncation logic
    const truncationResult = smartTruncate(smallOutput, { maxLines: 100 });
    const truncationMessage = formatTruncationMessage(truncationResult);

    expect(truncationResult.truncated).toBe(false);
    expect(truncationMessage).toBe("");
  });

  it("should handle very long lines like base64 content", () => {
    // Simulate a search result with base64 content
    const base64Line = `data.js:1:const image = "data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAA'.repeat(100)}";`;
    const normalLines = Array.from({ length: 5 }, (_, i) => `file${i}.js:${i}:normal line`);
    const content = [base64Line, ...normalLines].join('\n');

    const truncationResult = smartTruncate(content, { 
      maxLines: 100, 
      maxLineLength: 200 
    });

    expect(truncationResult.truncated).toBe(true);
    expect(truncationResult.content).toContain('... [line truncated]');
    expect(truncationResult.content.split('\n')[0].length).toBeLessThan(base64Line.length);
  });

  it("should handle content that exceeds character limit", () => {
    // Create content that exceeds character limit but not line limit
    const longLines = Array.from({ length: 10 }, (_, i) => 
      `file${i}.js:${i}:${'x'.repeat(600)} // long line content`
    );
    const content = longLines.join('\n');

    const truncationResult = smartTruncate(content, { 
      maxLines: 100, 
      maxChars: 3000 
    });

    expect(truncationResult.truncated).toBe(true);
    expect(truncationResult.truncatedCharCount).toBeLessThanOrEqual(3000);
    expect(truncationResult.truncatedLineCount).toBeLessThan(10);
  });
});
