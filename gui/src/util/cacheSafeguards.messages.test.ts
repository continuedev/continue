import type { ChatMessage, ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  detectCacheMiss,
  keyChanges,
  messageChecksum,
  promptCacheKey,
} from "./cacheSafeguards";
import type { PromptCacheSessionState } from "./promptCache";

const MIN = 60 * 1000;
const t0 = 1_000_000_000;

const sonnet: ModelDescription = {
  title: "s",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};

const user = (content: string): ChatMessage => ({ role: "user", content });
const assistant = (content: string, extra: object = {}): ChatMessage => ({
  role: "assistant",
  content,
  ...extra,
});
const key = (msgs: ChatMessage[]) =>
  promptCacheKey(sonnet, ["read_file"], "system A", msgs);

/** A conversation of n question and answer pairs. */
const convo = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => [
    user(`question ${i + 1}`),
    assistant(`answer ${i + 1}`),
  ]).flat();

describe("messageChecksum", () => {
  it("ignores what is attached after a message is sent", () => {
    const sent = assistant("hello");
    const later = assistant("hello", {
      usage: { promptTokens: 5, completionTokens: 7 },
      metadata: { responsesOutputItemId: "x" },
      id: "mid-1",
    });
    expect(messageChecksum(later)).toBe(messageChecksum(sent));
  });

  it("changes when the text, the role or a tool call changes", () => {
    const base = messageChecksum(assistant("hello"));
    expect(messageChecksum(assistant("hello!"))).not.toBe(base);
    expect(messageChecksum(user("hello"))).not.toBe(base);
    expect(
      messageChecksum(
        assistant("hello", {
          toolCalls: [{ id: "1", function: { name: "ls", arguments: "{}" } }],
        }),
      ),
    ).not.toBe(base);
  });
});

describe("keyChanges: an earlier message changed", () => {
  const before = key(convo(3));

  it("says nothing when the conversation only grew", () => {
    expect(keyChanges(before, key([...convo(3), user("question 4")]))).toEqual(
      [],
    );
    expect(keyChanges(before, key(convo(4)))).toEqual([]);
  });

  it("says nothing for the same conversation sent again", () => {
    expect(keyChanges(before, key(convo(3)))).toEqual([]);
  });

  it("names the first message that was edited", () => {
    const edited = convo(4);
    edited[2] = user("question 2, reworded");
    expect(keyChanges(before, key(edited))).toEqual([
      "an earlier message was edited or removed (message 3 of 8)",
    ]);
  });

  it("notices a message that was removed from the middle", () => {
    const cut = convo(4);
    cut.splice(2, 2);
    const [msg] = keyChanges(before, key(cut));
    expect(msg).toBe(
      "an earlier message was edited or removed (message 3 of 6)",
    );
  });

  it("notices a regenerated reply (the last answer replaced)", () => {
    const regenerated = [
      ...convo(2),
      user("question 3"),
      assistant("a new answer"),
    ];
    // the previous request ended at user 3 and answer 3; here answer 3 differs
    const prev = key([...convo(2), user("question 3"), assistant("answer 3")]);
    expect(keyChanges(prev, key(regenerated))).toEqual([
      "an earlier message was edited or removed (message 6 of 6)",
    ]);
  });

  it("is not compared when either key has no message list", () => {
    const old = promptCacheKey(sonnet, ["read_file"], "system A");
    expect(keyChanges(old, key(convo(3)))).toEqual([]);
    expect(keyChanges(before, old)).toEqual([]);
  });

  it("reports it next to the other causes, after them", () => {
    const edited = convo(4);
    edited[0] = user("different");
    const changed = promptCacheKey(
      sonnet,
      ["read_file", "grep"],
      "system B",
      edited,
    );
    expect(keyChanges(before, changed)).toEqual([
      "the tools changed",
      "the system prompt changed (a rule or a summary)",
      "an earlier message was edited or removed (message 1 of 8)",
    ]);
  });
});

describe("detectCacheMiss with an edited message", () => {
  const st = (k: ReturnType<typeof key>): PromptCacheSessionState => ({
    escalated: false,
    lastRequestAt: t0,
    lastTtl: "5m",
    lastInputTokens: 366_000,
    lastKey: k,
  });

  it("names an edited message as the cause of a miss", () => {
    const prev = key(convo(3));
    const edited = convo(4);
    edited[1] = assistant("an answer that was edited");
    const m = detectCacheMiss({
      before: st(prev),
      key: key(edited),
      requestAt: t0 + 30 * 1000,
      readTokens: 0,
      totalInputTokens: 370_000,
    })!;
    expect(m.causes).toEqual([
      "an earlier message was edited or removed (message 2 of 8)",
    ]);
  });

  it("still reports a miss with no known cause when nothing changed", () => {
    const prev = key(convo(3));
    const m = detectCacheMiss({
      before: st(prev),
      key: key(convo(4)),
      requestAt: t0 + 30 * 1000,
      readTokens: 0,
      totalInputTokens: 370_000,
    })!;
    expect(m.causes).toEqual([]);
  });

  it("is quiet after a 6 minute pause, whatever changed", () => {
    const prev = key(convo(3));
    const edited = convo(4);
    edited[0] = user("different");
    expect(
      detectCacheMiss({
        before: st(prev),
        key: key(edited),
        requestAt: t0 + 6 * MIN,
        readTokens: 0,
        totalInputTokens: 370_000,
      }),
    ).toBeUndefined();
  });
});
