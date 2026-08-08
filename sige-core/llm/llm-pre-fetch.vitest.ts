import { fetchwithRequestOptions } from "@continuedev/fetch";
import * as openAiAdapters from "@continuedev/openai-adapters";
import * as dotenv from "dotenv";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChatMessage, ILLM } from "..";
import Anthropic from "./llms/Anthropic";
import Gemini from "./llms/Gemini";
import OpenAI from "./llms/OpenAI";

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

  test("Invalid tool call args are ignored", async () => {
    const anthropic = new Anthropic({
      model: "not-important",
      apiKey: "invalid",
    });
    await dudLLMCall(anthropic, messagesWithInvalidToolCallArgs);
    expect(fetchwithRequestOptions).toHaveBeenCalledWith(
      expect.any(URL),
      {
        method: "POST",
        headers: expect.any(Object),
        signal: expect.any(AbortSignal),
        body: expect.stringContaining('"name":"say_name","input":{}'),
      },
      expect.any(Object),
    );

    vi.clearAllMocks();
    const gemini = new Gemini({ model: "gemini-something", apiKey: "invalid" });
    await dudLLMCall(gemini, messagesWithInvalidToolCallArgs);
    expect(fetchwithRequestOptions).toHaveBeenCalledWith(
      expect.any(URL),
      {
        method: "POST",
        // headers: expect.any(Object),
        signal: expect.any(AbortSignal),
        body: expect.stringContaining('"name":"say_name","args":{}'),
      },
      expect.any(Object),
    );

    // OPENAI DOES NOT NEED TO CLEAR INVALID TOOL CALL ARGS BECAUSE IT STORES THEM IN STRINGS
    vi.clearAllMocks();
    const openai = new OpenAI({ model: "gpt-something", apiKey: "invalid" });
    await dudLLMCall(openai, messagesWithInvalidToolCallArgs);
    expect(fetchwithRequestOptions).toHaveBeenCalledWith(
      expect.any(URL),
      {
        method: "POST",
        headers: expect.any(Object),
        signal: expect.any(AbortSignal),
        body: expect.stringContaining(JSON.stringify(invalidToolCallArg)),
      },
      expect.any(Object),
    );
  });
});
