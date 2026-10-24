import { describe, expect, it } from "vitest";

import { fromChatCompletionChunk, toChatMessage } from "./openaiTypeConverters";

describe("fromChatCompletionChunk gemini chunks", () => {
  it("keeps content, tool calls, extra_content, and the latest usage", () => {
    const message = fromChatCompletionChunk({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "gemini-2.5-flash",
      choices: [
        {
          index: 0,
          finish_reason: "tool_calls",
          logprobs: null,
          delta: {
            content: "calling",
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "read_file", arguments: "{}" },
                extra_content: { google: { thought_signature: "sig" } },
              } as any,
            ],
          },
        },
      ],
      usage: {
        prompt_tokens: 11,
        completion_tokens: 3,
        total_tokens: 14,
        prompt_tokens_details: { cached_tokens: 2 },
      },
    } as any);

    expect(message).toMatchObject({
      role: "assistant",
      content: "calling",
      usage: {
        promptTokens: 11,
        completionTokens: 3,
        promptTokensDetails: { cachedTokens: 2 },
      },
      toolCalls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "read_file", arguments: "{}" },
          extra_content: { google: { thought_signature: "sig" } },
        },
      ],
    });
  });

  it("records usage on a choices-less chunk and ignores unknown fields", () => {
    const message = fromChatCompletionChunk({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "gemini-2.5-flash",
      choices: [],
      extra_content: { google: { thought_signature: "unused" } },
      usage: {
        prompt_tokens: 4,
        completion_tokens: 2,
        total_tokens: 6,
      },
    } as any);

    expect(message).toEqual({
      role: "assistant",
      content: "",
      usage: {
        promptTokens: 4,
        completionTokens: 2,
      },
    });
  });

  it("round-trips extra_content onto the next chat request", () => {
    const parsed = fromChatCompletionChunk({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "gemini-2.5-flash",
      choices: [
        {
          index: 0,
          finish_reason: null,
          logprobs: null,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "read_file", arguments: "{}" },
                extra_content: { google: { thought_signature: "sig" } },
              },
            ],
          },
        },
      ],
    } as any);

    const outbound = toChatMessage(parsed!, { model: "gemini-2.5-flash" });
    expect((outbound as any).tool_calls[0].extra_content).toEqual({
      google: { thought_signature: "sig" },
    });
  });
});
