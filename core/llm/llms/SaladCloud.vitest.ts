import { describe, expect, it } from "vitest";

import SaladCloud from "./SaladCloud.js";

describe("SaladCloud", () => {
  it("disables Qwen thinking output by default", () => {
    const saladCloud = new SaladCloud({
      apiKey: "test-api-key",
      model: "qwen3.6-35b-a3b",
    });

    const body = (saladCloud as any)._convertArgs(
      {
        model: "qwen3.6-35b-a3b",
        maxTokens: 128,
      },
      [{ role: "user", content: "hello" }],
    );

    expect(body.chat_template_kwargs).toEqual({
      enable_thinking: false,
    });
  });

  it("preserves explicitly provided chat template kwargs", () => {
    const saladCloud = new SaladCloud({
      apiKey: "test-api-key",
      model: "qwen3.6-35b-a3b",
    });

    const body = (saladCloud as any).modifyChatBody({
      model: "qwen3.6-35b-a3b",
      messages: [],
      chat_template_kwargs: {
        enable_thinking: true,
        custom: "value",
      },
    });

    expect(body.chat_template_kwargs).toEqual({
      enable_thinking: true,
      custom: "value",
    });
  });
});
