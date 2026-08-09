// Unit tests for the stripThinkTags function

// Since stripThinkTags is currently a private function in chat.ts,
// we'll extract it for testing purposes. This follows the same pattern
// as other utility functions in the codebase.

/**
 * Strips <think></think> tags and excess whitespace from response
 * @param response - The raw response from the LLM
 * @returns Cleaned response
 */
function stripThinkTags(response: string): string {
  // Remove <think></think> tags and their content
  let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, "");

  // Remove excess whitespace: multiple consecutive newlines become single newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n");

  // Trim leading and trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

describe("stripThinkTags", () => {
  it("should remove simple think tags", () => {
    const input = `<think>
This is a thought
</think>

This is the actual content`;

    const expected = "This is the actual content";
    expect(stripThinkTags(input)).toBe(expected);
  });

  it("should remove multiple think tag blocks", () => {
    const input = `<think>First thought</think>

Content 1

<think>Second thought</think>

Content 2`;

    const expected = "Content 1\n\nContent 2";
    expect(stripThinkTags(input)).toBe(expected);
  });

  it("should handle think tags with nested content", () => {
    const input = `<think>
I need to think about:
1. Step one
2. Step two
   - Sub step
</think>

Final result`;

    const expected = "Final result";
    expect(stripThinkTags(input)).toBe(expected);
  });

  it("should reduce excess whitespace", () => {
    const input = `<think>Remove this</think>



Content with lots of space



More content`;

    const expected = "Content with lots of space\n\nMore content";
    expect(stripThinkTags(input)).toBe(expected);
  });

  it("should handle content without think tags", () => {
    const input = `#!/bin/bash
echo "Hello World"

This has no think tags.`;

    // Should return the same content (trimmed)
    expect(stripThinkTags(input)).toBe(input.trim());
  });

  it("should handle empty think tags", () => {
    const input = `<think></think>

Content after empty think tag`;

    const expected = "Content after empty think tag";
    expect(stripThinkTags(input)).toBe(expected);
  });

  it("should handle think tags at the end", () => {
    const input = `Content at the beginning

<think>
This thought is at the end
</think>`;

    const expected = "Content at the beginning";
    expect(stripThinkTags(input)).toBe(expected);
  });

  it("should handle complex whitespace patterns", () => {
    const input = `<think>Remove</think>
    
    
Content with indented whitespace
    
    
More content`;

    const result = stripThinkTags(input);
    // Should reduce triple+ newlines to double newlines
    expect(result).not.toMatch(/\n\s*\n\s*\n/);
    expect(result).toContain("Content with indented whitespace");
    expect(result).toContain("More content");
  });

  it("should handle think tags with special characters", () => {
    const input = `<think>
Special chars: !@#$%^&*()
Code: const x = () => { return "test"; }
</think>

Actual content`;

    const expected = "Actual content";
    expect(stripThinkTags(input)).toBe(expected);
  });

  it("should be case sensitive for think tags", () => {
    const input = `<THINK>This should not be removed</THINK>
<Think>This should not be removed</Think>
<think>This should be removed</think>

Content`;

    const result = stripThinkTags(input);
    expect(result).toContain("<THINK>This should not be removed</THINK>");
    expect(result).toContain("<Think>This should not be removed</Think>");
    expect(result).not.toContain("<think>This should be removed</think>");
    expect(result).toContain("Content");
  });

  it("should handle malformed think tags gracefully", () => {
    const input = `<think>Unclosed think tag

Content should remain`;

    // Should not remove unclosed tags
    expect(stripThinkTags(input)).toContain("<think>Unclosed think tag");
    expect(stripThinkTags(input)).toContain("Content should remain");
  });
});
