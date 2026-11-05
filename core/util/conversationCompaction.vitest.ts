import { describe, expect, it, vi } from "vitest";
import type { Session } from "..";
import { compactConversation } from "./conversationCompaction";

function sessionWithCache(): Session {
  return {
    sessionId: "s1",
    title: "t",
    workspaceDirectory: "",
    history: [
      { message: { role: "user", content: "hi" }, contextItems: [] },
      { message: { role: "assistant", content: "hello" }, contextItems: [] },
    ],
    promptCache: {
      lastRequestAt: 1_700_000_000_000,
      lastInputTokens: 366_000,
      lastTtl: "5m",
    },
  };
}

describe("compactConversation", () => {
  it("stores the summary and drops the saved prompt cache record", async () => {
    const session = sessionWithCache();
    const historyManager = {
      load: vi.fn(() => session),
      save: vi.fn(),
    } as any;
    const currentModel = {
      chat: vi.fn(async () => ({ role: "assistant", content: "a summary" })),
    } as any;

    await compactConversation({
      sessionId: "s1",
      index: 1,
      historyManager,
      currentModel,
    });

    const saved = historyManager.save.mock.calls[0][0] as Session;
    expect(saved.history[1].conversationSummary).toBe("a summary");
    // The conversation is now short, so the old size and time would mislead
    // the cold-cache notice when the session is next opened.
    expect(saved.promptCache).toBeUndefined();
    expect(saved.sessionId).toBe("s1");
  });

  it("does not change the session it was given", async () => {
    const session = sessionWithCache();
    const historyManager = { load: () => session, save: vi.fn() } as any;
    const currentModel = {
      chat: async () => ({ role: "assistant", content: "x" }),
    } as any;
    await compactConversation({
      sessionId: "s1",
      index: 1,
      historyManager,
      currentModel,
    });
    expect(session.promptCache?.lastInputTokens).toBe(366_000);
  });
});

describe("compactConversation with the conversation prefix", () => {
  const prefix = {
    messages: [
      { role: "system" as const, content: "the system prompt" },
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
    ],
    options: {
      tools: [{ function: { name: "read_file" } }] as any,
      promptCaching: true,
      promptCacheTtl: "1h" as const,
    },
  };
  const run = async (chat: any, withPrefix: boolean) => {
    const session = sessionWithCache();
    const historyManager = { load: () => session, save: vi.fn() } as any;
    await compactConversation({
      sessionId: "s1",
      index: 1,
      historyManager,
      currentModel: { chat } as any,
      ...(withPrefix && { conversationPrefix: prefix }),
    });
    return historyManager.save.mock.calls[0][0] as Session;
  };

  it("sends the conversation's messages, then the summary prompt, with its options", async () => {
    const chat = vi.fn(async () => ({
      role: "assistant",
      content: "a summary",
    }));
    const saved = await run(chat, true);
    expect(chat).toHaveBeenCalledTimes(1);
    const [messages, , options] = chat.mock.calls[0] as any[];
    expect(messages.slice(0, 3)).toEqual(prefix.messages);
    expect(messages).toHaveLength(4);
    expect(messages[3].role).toBe("user");
    expect(messages[3].content).toContain("Create a comprehensive summary");
    expect(messages[3].content).toContain("Do not call any tool");
    expect(options).toEqual(prefix.options);
    expect(saved.history[1].conversationSummary).toBe("a summary");
  });

  it("does not change the conversation's own messages", async () => {
    const chat = vi.fn(async () => ({ role: "assistant", content: "s" }));
    const before = JSON.stringify(prefix);
    await run(chat, true);
    expect(JSON.stringify(prefix)).toBe(before);
  });

  it("falls back to the plain request when the reply has no text", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce({ role: "assistant", content: "  " })
      .mockResolvedValueOnce({ role: "assistant", content: "plain summary" });
    const saved = await run(chat, true);
    expect(chat).toHaveBeenCalledTimes(2);
    const [messages, , options] = chat.mock.calls[1] as any[];
    expect(options).toEqual({});
    expect(messages.some((m: any) => m.role === "system")).toBe(false);
    expect(saved.history[1].conversationSummary).toBe("plain summary");
  });

  it("is the old request exactly when no prefix is given", async () => {
    const chat = vi.fn(async () => ({ role: "assistant", content: "s" }));
    await run(chat, false);
    const [messages, , options] = chat.mock.calls[0] as any[];
    expect(options).toEqual({});
    expect(messages.some((m: any) => m.role === "system")).toBe(false);
    expect(messages[messages.length - 1].content).not.toContain(
      "Do not call any tool",
    );
  });
});
