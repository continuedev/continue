import { describe, expect, it } from "vitest";

import { OpenAIApi } from "./OpenAI.js";

describe("OpenAIApi requestOptions.timeout", () => {
  it("converts timeout from seconds to milliseconds for the OpenAI SDK", () => {
    // requestOptions.timeout is expressed in seconds throughout Continue
    // (see packages/fetch getAgentOptions, which multiplies by 1000), but the
    // OpenAI JS SDK expects milliseconds. A value of 300 must become 300000.
    const api = new OpenAIApi({
      provider: "openai",
      apiKey: "test-key",
      requestOptions: { timeout: 300 },
    } as any);

    expect(api.openai.timeout).toBe(300_000);
  });

  it("leaves the SDK default in place when no timeout is set", () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiKey: "test-key",
    } as any);

    // OpenAI SDK default is 600000 ms (10 minutes).
    expect(api.openai.timeout).toBe(600_000);
  });
});
