import { describe, expect, it } from "vitest";

import { OpenAIApi } from "./OpenAI.js";

describe("OpenAIApi requestOptions.extraBodyProperties", () => {
  it("adds the config's extra body fields to every chat body", () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiBase: "http://127.0.0.1:8080/v1/",
      requestOptions: {
        extraBodyProperties: {
          reasoning_effort: "low",
          chat_template_kwargs: { enable_thinking: false },
        },
      },
    });
    const body = api.modifyChatBody({
      model: "qwen3.8-flash-next-nvfp4-nvfp4",
      messages: [{ role: "user", content: "ok" }],
      stream: true,
    }) as any;
    expect(body.reasoning_effort).toBe("low");
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("sends nothing extra when none are configured", () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiBase: "http://127.0.0.1:8080/v1/",
    });
    const body = api.modifyChatBody({
      model: "m",
      messages: [{ role: "user", content: "ok" }],
    }) as any;
    expect(body.reasoning_effort).toBeUndefined();
  });
});
