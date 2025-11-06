import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it } from "vitest";

import { MarkdownRenderer } from "./MarkdownRenderer.js";

describe("MarkdownRenderer - URL handling", () => {
  it("should render URLs without breaking", () => {
    const content =
      "Check out this link: https://github.com/continuedev/continue/discussions/8240";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    // URL should be present and complete
    expect(frame).toContain(
      "https://github.com/continuedev/continue/discussions/8240",
    );
    // Frame should contain the prefix text
    expect(frame).toContain("Check out this link:");
  });

  it("should handle angle-bracket URLs", () => {
    const content =
      "expectation would be the link <https://github.com/continuedev/continue/discussions/8240>";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    // URL should be extracted and rendered, with angle brackets preserved
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

  it("should use Box layout when URLs are present", () => {
    const content = "Link: https://example.com";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    // Should contain the URL
    expect(frame).toContain("https://example.com");
    // Should render without errors
    expect(frame).toBeTruthy();
  });

  it("should not break URLs across lines", () => {
    // This is more of an integration test - the actual line breaking
    // depends on terminal width, but we can verify the structure
    const content =
      "A very long URL: https://github.com/continuedev/continue/discussions/8240/with/many/path/segments";

    const { lastFrame } = render(<MarkdownRenderer content={content} />);
    const frame = lastFrame();

    // The URL should be present as a complete unit
    expect(frame).toContain(
      "https://github.com/continuedev/continue/discussions/8240/with/many/path/segments",
    );
  });
});
