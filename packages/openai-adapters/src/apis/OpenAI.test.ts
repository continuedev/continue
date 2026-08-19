import { describe, expect, it } from "vitest";

import { OpenAIApi } from "./OpenAI.js";

describe("OpenAIApi timeout conversion", () => {
  const baseConfig = {
    provider: "openai" as const,
    apiKey: "test-key",
  };

  it("converts requestOptions.timeout from seconds to milliseconds", () => {
    const api = new OpenAIApi({
      ...baseConfig,
      requestOptions: { timeout: 300 },
    });

    expect(api.openai.timeout).toBe(300_000);
  });

  it("preserves an explicit zero timeout instead of falling back to the SDK default", () => {
    const api = new OpenAIApi({
      ...baseConfig,
      requestOptions: { timeout: 0 },
    });

    // The schema permits `timeout: 0`, and the SDK resolves its own default
    // with `?? DEFAULT_TIMEOUT`, so 0 must survive as 0 rather than becoming
    // undefined and silently turning into the 10-minute default.
    expect(api.openai.timeout).toBe(0);
  });

  it("leaves the SDK default in place when no timeout is configured", () => {
    const api = new OpenAIApi(baseConfig);

    // 10 minutes — the OpenAI SDK's DEFAULT_TIMEOUT.
    expect(api.openai.timeout).toBe(600_000);
  });
});
