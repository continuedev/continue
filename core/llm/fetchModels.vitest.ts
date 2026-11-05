import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchModels, windowFromInputAndOutput } from "./fetchModels";

describe("windowFromInputAndOutput", () => {
  it("adds the output limit to the input limit", () => {
    expect(windowFromInputAndOutput(100_000, 128_000)).toBe(228_000);
  });
  it("keeps an input limit with no output limit", () => {
    expect(windowFromInputAndOutput(200_000, undefined)).toBe(200_000);
  });
  it("is undefined without an input limit", () => {
    expect(windowFromInputAndOutput(undefined, 8_192)).toBeUndefined();
  });
});

describe("fetchModels: separate input/output limits", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    );

  it("Anthropic: input budget equals max_input_tokens", async () => {
    respond({
      data: [
        {
          id: "claude-opus-5-5",
          display_name: "Claude Opus 5.5",
          max_input_tokens: 100_000,
          max_tokens: 128_000,
        },
      ],
    });
    const [m] = await fetchModels("anthropic", "key");
    expect(m.maxTokens).toBe(128_000);
    // The prompt is pruned to contextLength - maxTokens.
    expect(m.contextLength! - m.maxTokens!).toBe(100_000);
  });

  it("Gemini: input budget equals inputTokenLimit", async () => {
    respond({
      models: [
        {
          name: "models/gemini-test",
          displayName: "Gemini Test",
          inputTokenLimit: 1_048_576,
          outputTokenLimit: 65_536,
          supportedGenerationMethods: ["generateContent"],
        },
      ],
    });
    const [m] = await fetchModels("gemini", "key");
    expect(m.contextLength! - m.maxTokens!).toBe(1_048_576);
  });
});
