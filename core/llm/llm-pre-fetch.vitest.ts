import * as openAiAdapters from "@continuedev/openai-adapters";
import * as dotenv from "dotenv";
import { beforeEach, describe, vi } from "vitest";
import { ChatMessage, ILLM } from "..";

dotenv.config();

vi.mock("@continuedev/fetch");
vi.mock("@continuedev/openai-adapters");

async function dudLLMCall(llm: ILLM, messages: ChatMessage[]) {
  try {
    const abortController = new AbortController();
    const gen = llm.streamChat(messages, abortController.signal, {});
    await gen.next();
    await gen.return({
      completion: "",
      modelTitle: "",
      modelProvider: "",
      prompt: "",
    });
    abortController.abort();
  } catch (e) {
    console.error("Expected error", e);
  }
}

const invalidToolCallArg = '{"name": "Ali';
const messagesWithInvalidToolCallArgs: ChatMessage[] = [
  {
    role: "user",
    content: "Call the say_hello tool",
  },
  {
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id: "tool_call_1",
        type: "function",
        function: {
          name: "say_name",
          arguments: invalidToolCallArg,
        },
      },
    ],
  },
  {
    role: "user",
    content: "This is my response",
  },
];

describe("LLM Pre-fetch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock getAnthropicHeaders to return fake headers
    vi.mocked(openAiAdapters.getAnthropicHeaders).mockReturnValue({
      fake: "headers",
    });
    // Log to verify the mock is properly set up
    console.log("Mock setup:", openAiAdapters);
  });
});
