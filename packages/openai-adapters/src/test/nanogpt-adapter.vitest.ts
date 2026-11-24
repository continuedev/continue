import { describe, expect, it } from "vitest";

import { OpenAIApi } from "../apis/OpenAI.js";
import { constructLlmApi } from "../index.js";

describe("NanoGPT adapter registration", () => {
  it("accepts the provider and constructs the OpenAI-compatible adapter", () => {
    const config = {
      provider: "nanogpt" as const,
      apiKey: "test-key",
    };
    const api = constructLlmApi(config);
    expect(api).toBeInstanceOf(OpenAIApi);
    expect((api as OpenAIApi).apiBase).toBe("https://nano-gpt.com/api/v1/");
  });

  it("honors a custom base URL", () => {
    const api = constructLlmApi({
      provider: "nanogpt" as const,
      apiBase: "https://example.com/v1/",
    });
    expect((api as OpenAIApi).apiBase).toBe("https://example.com/v1/");
  });
});
