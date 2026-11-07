import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceContainer } from "../services/ServiceContainer.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";

import { executeSubAgent } from "./executor.js";

const parentPermissions = {
  permissions: { policies: [{ tool: "*", permission: "allow" }] },
  currentMode: "normal",
};

vi.mock("../stream/streamChatResponse.js", () => ({
  streamChatResponse: vi.fn(),
}));
vi.mock("../services/ServiceContainer.js", () => ({
  serviceContainer: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("../services/index.js", () => ({
  services: {
    systemMessage: { getSystemMessage: vi.fn(async () => "parent system") },
    toolPermissions: { getState: () => parentPermissions },
    chatHistory: { isReady: () => true },
  },
}));
vi.mock("../util/logger.js", () => ({
  logger: { debug: vi.fn(), error: vi.fn() },
}));

const agent = {
  model: { name: "explorer", chatOptions: { baseSystemMessage: "explore" } },
  llmApi: {},
} as any;

describe("executeSubAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serviceContainer.get).mockResolvedValue(parentPermissions);
  });

  it("runs parallel subagents one after another and restores the parent's permissions", async () => {
    const events: string[] = [];
    vi.mocked(streamChatResponse).mockImplementation(async (history: any) => {
      const name = history[0].message.content;
      events.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, 20));
      history.push({
        message: { role: "assistant", content: `done ${name}` },
        contextItems: [],
      });
      events.push(`end ${name}`);
      return "";
    });

    const run = (prompt: string) =>
      executeSubAgent({
        agent,
        prompt,
        parentSessionId: "p",
        abortController: new AbortController(),
      });
    const [a, b] = await Promise.all([run("a"), run("b")]);

    expect(events).toEqual(["start a", "end a", "start b", "end b"]);
    expect(a).toEqual({ success: true, response: "done a" });
    expect(b).toEqual({ success: true, response: "done b" });

    // Each run sets the subagent's permissions, then puts the parent's back
    const sets = vi.mocked(serviceContainer.set).mock.calls.map((c) => c[1]);
    expect(sets.at(-1)).toBe(parentPermissions);
    expect(sets[0]).not.toBe(parentPermissions);
  });

  it("a failing run does not block the next one", async () => {
    vi.mocked(streamChatResponse)
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce(async (history: any) => {
        history.push({
          message: { role: "assistant", content: "ok" },
          contextItems: [],
        });
        return "";
      });

    const run = (prompt: string) =>
      executeSubAgent({
        agent,
        prompt,
        parentSessionId: "p",
        abortController: new AbortController(),
      });
    const [failed, ok] = await Promise.all([run("x"), run("y")]);

    expect(failed).toMatchObject({ success: false, error: "boom" });
    expect(ok).toEqual({ success: true, response: "ok" });
  });
});
