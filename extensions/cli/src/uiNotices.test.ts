import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistoryWithSystemMessage } from "core/util/messageConversion.js";

import {
  type ChatHistoryItemWithType,
  isUiNotice,
  withoutUiNotices,
} from "./uiNotices.js";

function item(
  role: "user" | "assistant" | "system",
  content: string,
  messageType?: "system",
): ChatHistoryItem {
  const historyItem: ChatHistoryItemWithType = {
    message: { role, content },
    contextItems: [],
    messageType,
  };
  return historyItem;
}

describe("isUiNotice", () => {
  it("identifies a notice by messageType, not by role", () => {
    expect(
      isUiNotice(item("system", "Switched to model: gpt-4o", "system")),
    ).toBe(true);
  });

  it("does not treat a real system message as a notice", () => {
    // Same role, no discriminator — this is an instruction for the model.
    expect(isUiNotice(item("system", "You are a helpful assistant."))).toBe(
      false,
    );
  });

  it("does not treat user or assistant messages as notices", () => {
    expect(isUiNotice(item("user", "hello"))).toBe(false);
    expect(isUiNotice(item("assistant", "hi"))).toBe(false);
  });
});

describe("withoutUiNotices", () => {
  it("drops notices and keeps everything else in order", () => {
    const history = [
      item("user", "hello"),
      item("system", "Switched to model: gpt-4o", "system"),
      item("assistant", "hi"),
      item("system", "Failed to switch model: boom", "system"),
      item("user", "still there?"),
    ];

    const result = withoutUiNotices(history);

    expect(result.map((i) => i.message.content)).toEqual([
      "hello",
      "hi",
      "still there?",
    ]);
  });

  it("keeps a real system message", () => {
    const history = [item("system", "You are a helpful assistant.")];
    expect(withoutUiNotices(history)).toHaveLength(1);
  });

  it("leaves a history with no notices untouched", () => {
    const history = [item("user", "hello"), item("assistant", "hi")];
    expect(withoutUiNotices(history)).toEqual(history);
  });
});

describe("conversion after filtering", () => {
  it("no longer emits a system message at a non-zero index", () => {
    // Reproduces the shape that made providers return
    // "System message must be at the beginning": a /model notice recorded in the
    // history becomes a second role:"system" entry after the user turn.
    const history = [
      item("user", "hello"),
      item("system", "Switched to model: gpt-4o", "system"),
      item("user", "and now?"),
    ];

    const unfiltered = convertFromUnifiedHistoryWithSystemMessage(
      history,
      "real system prompt",
    );
    const offendingIndexes = unfiltered
      .map((m, i) => (m.role === "system" ? i : -1))
      .filter((i) => i > 0);
    expect(offendingIndexes.length).toBeGreaterThan(0);

    const filtered = convertFromUnifiedHistoryWithSystemMessage(
      withoutUiNotices(history),
      "real system prompt",
    );
    expect(filtered.filter((m) => m.role === "system")).toHaveLength(1);
    expect(filtered[0]?.role).toBe("system");
    expect(filtered[0]?.content).toBe("real system prompt");
  });
});
