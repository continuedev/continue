import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it } from "vitest";

import { MarkdownRenderer } from "./MarkdownRenderer.js";

describe("MarkdownRenderer - URL handling", () => {
  it("should render URLs without breaking them across lines", () => {
    const content =
      "Check out this link: https://github.com/continuedev/continue/discussions/8240";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    // URL should be present and complete
    expect(frame).toContain(
      "https://github.com/continuedev/continue/discussions/8240",
    );
    // URL should be in cyan color (ANSI escape codes for cyan)
    expect(frame).toContain("\x1B[36m");
  });

  it("should handle angle-bracket URLs", () => {
    const content =
      "expectation would be the link <https://github.com/continuedev/continue/discussions/8240>";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    // URL should be extracted from angle brackets and rendered
    expect(frame).toContain(
      "https://github.com/continuedev/continue/discussions/8240",
    );
  });

  it("should handle multiple URLs in the same content", () => {
    const content =
      "Check https://example.com and also https://github.com/continuedev/continue";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    expect(frame).toContain("https://example.com");
    expect(frame).toContain("https://github.com/continuedev/continue");
  });

  it("should handle URLs with markdown text", () => {
    const content =
      "This is **bold text** and this is a link: https://continue.dev and more text.";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    expect(frame).toContain("bold text");
    expect(frame).toContain("https://continue.dev");
  });

  it("should handle http URLs", () => {
    const content = "Visit http://localhost:3000/api/endpoint";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    expect(frame).toContain("http://localhost:3000/api/endpoint");
  });
});
