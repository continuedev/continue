import { ChatCompletionCreateParams } from "openai/resources/index";
import { describe, expect, it } from "vitest";

import { OpenAIApi } from "./OpenAI.js";

const streamingBody = (): ChatCompletionCreateParams => ({
  model: "gpt-4.1",
  messages: [{ role: "user", content: "hello" }],
  stream: true,
});

describe("OpenAIApi modifyChatBody stream_options", () => {
  it("adds stream_options for official OpenAI streaming requests", () => {
    const api = new OpenAIApi({ provider: "openai", apiKey: "test-key" });

    const modifiedBody = api.modifyChatBody(streamingBody());

    expect((modifiedBody as any).stream_options).toEqual({ include_usage: true });
  });

  it("does not add OpenAI-only stream_options for compatible endpoints", () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiKey: "test-key",
      apiBase: "https://example.cloud.databricks.com/serving-endpoints/chat/invocations",
    });

    const modifiedBody = api.modifyChatBody(streamingBody());

    expect((modifiedBody as any).stream_options).toBeUndefined();
  });
});
