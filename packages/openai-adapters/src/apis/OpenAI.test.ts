import { describe, expect, test } from "vitest";
import { OpenAIApi } from "./OpenAI.js";

describe("OpenAIApi", () => {
  test("converts Continue request timeout seconds to OpenAI SDK milliseconds", () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiKey: "test-api-key",
      requestOptions: { timeout: 300 },
    });

    expect(api.openai.timeout).toBe(300_000);
  });

  test("preserves an omitted timeout so the OpenAI SDK default still applies", () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiKey: "test-api-key",
    });

    expect(api.openai.timeout).toBe(600_000);
  });

  test("preserves an explicit zero timeout instead of treating it as omitted", () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiKey: "test-api-key",
      requestOptions: { timeout: 0 },
    });

    expect(api.openai.timeout).toBe(0);
  });
});
