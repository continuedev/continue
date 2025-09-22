import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it } from "vitest";

import type {
  ChatHistoryItem,
  MessageContent,
  MessagePart,
} from "../../../../../core/index.js";

import { MemoizedMessage } from "./MemoizedMessage.js";

describe("MemoizedMessage formatMessageContentForDisplay", () => {
  const createTestHistoryItem = (content: MessageContent): ChatHistoryItem => ({
    message: {
      role: "user",
      content,
    },
    contextItems: [],
  });

  it("should display string content as-is", () => {
    const content = "Just a simple text message";
    const historyItem = createTestHistoryItem(content);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    expect(lastFrame()).toContain("Just a simple text message");
  });

  it("should display message with images using placeholders", () => {
    const messageParts: MessagePart[] = [
      { type: "text", text: "Here is an image: " },
      { type: "imageUrl", imageUrl: { url: "data:image/png;base64,abc123" } },
      { type: "text", text: " and some more text" },
    ];
    const historyItem = createTestHistoryItem(messageParts);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    const output = lastFrame();
    expect(output).toContain("Here is an image: [Image #1] and some more text");
    expect(output).not.toContain("data:image/png;base64,abc123");
    expect(output).not.toContain("imageUrl");
  });

  it("should display message with multiple images using incrementing placeholders", () => {
    const messageParts: MessagePart[] = [
      { type: "text", text: "First " },
      { type: "imageUrl", imageUrl: { url: "data:image/png;base64,abc123" } },
      { type: "text", text: " then text " },
      { type: "imageUrl", imageUrl: { url: "data:image/jpeg;base64,def456" } },
      { type: "text", text: " end" },
    ];
    const historyItem = createTestHistoryItem(messageParts);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    const output = lastFrame();
    expect(output).toContain("First [Image #1] then text [Image #2] end");
    expect(output).not.toContain("data:image/png;base64");
    expect(output).not.toContain("data:image/jpeg;base64");
  });

  it("should display message with only images", () => {
    const messageParts: MessagePart[] = [
      { type: "imageUrl", imageUrl: { url: "data:image/png;base64,abc123" } },
      { type: "imageUrl", imageUrl: { url: "data:image/png;base64,def456" } },
    ];
    const historyItem = createTestHistoryItem(messageParts);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    const output = lastFrame();
    expect(output).toContain("[Image #1][Image #2]");
  });

  it("should handle empty text parts gracefully", () => {
    const messageParts: MessagePart[] = [
      { type: "text", text: "" },
      { type: "imageUrl", imageUrl: { url: "data:image/png;base64,abc123" } },
      { type: "text", text: "" },
    ];
    const historyItem = createTestHistoryItem(messageParts);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    const output = lastFrame();
    expect(output).toContain("[Image #1]");
    expect(output).not.toContain("data:image/png;base64");
  });

  it("should display text-only message parts as regular string", () => {
    const messageParts: MessagePart[] = [
      { type: "text", text: "Just text, no images here" },
    ];
    const historyItem = createTestHistoryItem(messageParts);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    expect(lastFrame()).toContain("Just text, no images here");
  });

  it("should handle unknown part types by converting to JSON", () => {
    const messageParts = [
      { type: "text", text: "Start " },
      { type: "unknown", data: { some: "data" } },
      { type: "text", text: " end" },
    ] as MessagePart[];
    const historyItem = createTestHistoryItem(messageParts);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    const output = lastFrame();
    // Verify whitespace preservation - trailing space after "Start" and leading space before "end"
    expect(output).toContain(
      'Start {"type":"unknown","data":{"some":"data"}} end',
    );
  });

  it("should handle non-array non-string content by converting to JSON", () => {
    const content = { someObject: "data" } as any;
    const historyItem = createTestHistoryItem(content);

    const { lastFrame } = render(
      <MemoizedMessage item={historyItem} index={1} />,
    );

    expect(lastFrame()).toContain('{"someObject":"data"}');
  });
});
