import type { ChatHistoryItem } from "core/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { services } from "../services/index.js";

import { handleToolCalls } from "./handleToolCalls.js";
import {
  executeStreamedToolCalls,
  preprocessStreamedToolCalls,
} from "./streamChatResponse.helpers.js";

vi.mock("./streamChatResponse.helpers.js", async (original) => ({
  ...(await original<object>()),
  preprocessStreamedToolCalls: vi.fn(),
  executeStreamedToolCalls: vi.fn(),
}));
vi.mock("../services/index.js", () => ({
  services: {
    chatHistory: {
      isReady: vi.fn(),
      addAssistantMessage: vi.fn(),
      addToolResult: vi.fn(),
    },
  },
}));

const CALL = {
  id: "call_1",
  name: "Read",
  arguments: { filepath: "a.ts" },
  argumentsStr: '{"filepath":"a.ts"}',
  startedAt: "",
};

function run(history: ChatHistoryItem[]) {
  return handleToolCalls({
    toolCalls: [CALL],
    chatHistory: history,
    content: "",
    isHeadless: true,
  } as never);
}

describe("handleToolCalls with a history of its own (a subagent)", () => {
  beforeEach(() => {
    vi.mocked(preprocessStreamedToolCalls).mockResolvedValue({
      preprocessedCalls: [CALL],
      errorChatEntries: [],
    } as never);
    vi.mocked(executeStreamedToolCalls).mockResolvedValue({
      hasRejection: false,
      chatHistoryEntries: [
        {
          role: "tool",
          tool_call_id: "call_1",
          content: "the file's contents",
          status: "done",
        },
      ],
    } as never);
  });

  it("puts each tool's result on its own history, for the next request", async () => {
    vi.mocked(services.chatHistory.isReady).mockReturnValue(false);
    const history: ChatHistoryItem[] = [];
    await run(history);

    expect(history).toHaveLength(1);
    expect(history[0].toolCallStates?.[0]).toMatchObject({
      status: "done",
      output: [{ content: "the file's contents" }],
    });
  });

  it("leaves the result to the service in the main session", async () => {
    vi.mocked(services.chatHistory.isReady).mockReturnValue(true);
    const history: ChatHistoryItem[] = [];
    await run(history);

    expect(history).toHaveLength(0);
    expect(services.chatHistory.addAssistantMessage).toHaveBeenCalled();
  });
});
