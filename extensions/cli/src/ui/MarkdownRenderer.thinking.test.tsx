import { render } from "ink-testing-library";
import React from "react";

import { MarkdownRenderer } from "./MarkdownRenderer.js";

describe("MarkdownRenderer - thinking tags", () => {
  it("handles multiple thinking tags", () => {
    const content =
      "Text <think>First thought</think> middle <think>Second thought</think> end";
    const { lastFrame } = render(<MarkdownRenderer content={content} />);

    expect(lastFrame()).toContain("First thought");
    expect(lastFrame()).toContain("Second thought");
  });

  it("handles thinking tags with multiline content", () => {
    const content = `<think>
    This is a multiline
    thinking block
    </think>`;
    const { lastFrame } = render(<MarkdownRenderer content={content} />);

    expect(lastFrame()).toContain("This is a multiline");
    expect(lastFrame()).toContain("thinking block");
  });

  it("ignores thinking tags inside code blocks", () => {
    const content = "```\n<think>This should not be processed</think>\n```";
    const { lastFrame } = render(<MarkdownRenderer content={content} />);

    // The thinking tag should appear as literal text within the code block
    expect(lastFrame()).toContain(
      "<think>This should not be processed</think>",
    );
  });
});
