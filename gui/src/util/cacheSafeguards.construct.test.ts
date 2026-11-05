import type { ChatHistoryItem, ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import { constructMessages } from "../redux/util/constructMessages";
import { keyChanges, promptCacheKey } from "./cacheSafeguards";

const sonnet: ModelDescription = {
  title: "s",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};

const userItem = (text: string, ctx = ""): ChatHistoryItem => ({
  message: { role: "user", content: text },
  contextItems: ctx
    ? [
        {
          id: { providerTitle: "file", itemId: ctx },
          name: ctx,
          description: ctx,
          content: `contents of ${ctx}`,
        },
      ]
    : [],
});

const assistantItem = (
  text: string,
  extra: Partial<ChatHistoryItem> = {},
): ChatHistoryItem => ({
  message: { role: "assistant", content: text },
  contextItems: [],
  ...extra,
});

/** The key the thunk builds for a history, the way the thunk builds it. */
function keyFor(history: ChatHistoryItem[]) {
  const { messages } = constructMessages(history, "base system", [], {});
  const system = messages.find((m) => m.role === "system");
  return promptCacheKey(
    sonnet,
    ["read_file"],
    system ? String((system as any).content) : undefined,
    messages.filter((m) => m.role !== "system"),
  );
}

describe("the key built from real constructMessages output", () => {
  const history: ChatHistoryItem[] = [
    userItem("fix the bug", "a.ts"),
    assistantItem("looking", {
      message: {
        role: "assistant",
        content: "looking",
        toolCalls: [
          {
            id: "t1",
            type: "function",
            function: { name: "read_file", arguments: "{}" },
          },
        ],
      },
      toolCallStates: [
        {
          toolCallId: "t1",
          toolCall: {
            id: "t1",
            type: "function",
            function: { name: "read_file", arguments: "{}" },
          },
          status: "done",
          parsedArgs: {},
          output: [
            {
              name: "a.ts",
              description: "a",
              content: "file text",
              icon: "",
            } as any,
          ],
        } as any,
      ],
    }),
    assistantItem("done"),
  ];

  it("does not call a conversation that only grew an edit", () => {
    const before = keyFor(history);
    const after = keyFor([
      ...history,
      userItem("thanks"),
      assistantItem("welcome"),
    ]);
    expect(keyChanges(before, after)).toEqual([]);
  });

  it("ignores usage and ids attached to a reply after it was sent", () => {
    const before = keyFor(history);
    const withUsage = history.map((h, i) =>
      i === 2
        ? {
            ...h,
            message: {
              ...h.message,
              usage: { promptTokens: 5, completionTokens: 9 },
              metadata: { responsesOutputItemId: "abc" },
            },
          }
        : h,
    ) as ChatHistoryItem[];
    expect(keyChanges(before, keyFor(withUsage))).toEqual([]);
  });

  it("does notice an edited earlier message, with its context item", () => {
    const before = keyFor(history);
    const edited = [userItem("fix the other bug", "a.ts"), ...history.slice(1)];
    const [cause] = keyChanges(before, keyFor(edited));
    expect(cause).toMatch(
      /^an earlier message was edited or removed \(message 1 of /,
    );
  });

  it("notices a context item that changed on an earlier message", () => {
    const before = keyFor(history);
    const changed = [userItem("fix the bug", "b.ts"), ...history.slice(1)];
    expect(keyChanges(before, keyFor(changed))).toHaveLength(1);
  });
});
