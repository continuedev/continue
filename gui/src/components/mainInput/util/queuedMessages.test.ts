import { describe, expect, it } from "vitest";
import { mergeQueuedMessages, queuedMessagePreview } from "./queuedMessages";

const doc = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
});

describe("mergeQueuedMessages", () => {
  it("returns nothing for an empty queue and a single message unchanged", () => {
    expect(mergeQueuedMessages([])).toBeUndefined();
    const one = {
      editorState: doc("a"),
      modifiers: { useCodebase: false, noContext: false },
    };
    expect(mergeQueuedMessages([one])).toBe(one);
  });

  it("joins messages in order and keeps the last modifiers", () => {
    const merged = mergeQueuedMessages([
      {
        editorState: doc("first"),
        modifiers: { useCodebase: false, noContext: false },
      },
      {
        editorState: doc("second", "third"),
        modifiers: { useCodebase: true, noContext: false },
      },
    ]);
    expect(merged?.editorState).toEqual(doc("first", "second", "third"));
    expect(merged?.modifiers).toEqual({ useCodebase: true, noContext: false });
  });
});

describe("queuedMessagePreview", () => {
  it("flattens paragraphs, mentions and images to one line", () => {
    expect(
      queuedMessagePreview({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Also check" },
              { type: "mention", attrs: { id: "x", label: "README.md" } },
            ],
          },
          { type: "paragraph", content: [{ type: "image", attrs: {} }] },
          { type: "paragraph", content: [{ type: "text", text: "thanks" }] },
        ],
      }),
    ).toBe("Also check@README.md [image] thanks");
  });
});
