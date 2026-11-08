import { describe, expect, it } from "vitest";

import { fillMissingToolResults } from "./bedrockHelpers.js";

const use = (toolUseId: string) => ({ toolUse: { toolUseId } });
const result = (toolUseId: string, text = "output") => ({
  toolResult: { toolUseId, content: [{ text }] },
});
const CANCELLED = "cancelled";

describe("fillMissingToolResults", () => {
  it("puts the result first in the user message after the call", () => {
    const filled = fillMissingToolResults(
      [
        { role: "user", content: [{ text: "ask" }] },
        { role: "assistant", content: [use("a")] },
        { role: "user", content: [{ text: "steer" }] },
      ],
      CANCELLED,
    );
    expect(filled).toHaveLength(3);
    expect(filled[2].content).toEqual([
      result("a", CANCELLED),
      { text: "steer" },
    ]);
  });

  it("adds a user message when the history ends on the call", () => {
    const filled = fillMissingToolResults(
      [{ role: "assistant", content: [use("a")] }],
      CANCELLED,
    );
    expect(filled[1]).toEqual({
      role: "user",
      content: [result("a", CANCELLED)],
    });
  });

  it("adds a user message between two assistant messages", () => {
    const filled = fillMissingToolResults(
      [
        { role: "assistant", content: [use("a")] },
        { role: "assistant", content: [{ text: "next" }] },
      ],
      CANCELLED,
    );
    expect(filled.map((m) => m.role)).toEqual([
      "assistant",
      "user",
      "assistant",
    ]);
  });

  it("fills only the calls of a parallel set that have no result", () => {
    const filled = fillMissingToolResults(
      [
        { role: "assistant", content: [use("a"), use("b")] },
        { role: "user", content: [result("b")] },
      ],
      CANCELLED,
    );
    expect(filled[1].content).toEqual([result("a", CANCELLED), result("b")]);
  });

  it("leaves a complete conversation as it was", () => {
    const messages = [
      { role: "assistant", content: [use("a")] },
      { role: "user", content: [result("a")] },
      { role: "assistant", content: [{ text: "done" }] },
    ];
    const before = structuredClone(messages);
    expect(fillMissingToolResults(messages, CANCELLED)).toEqual(before);
  });
});
