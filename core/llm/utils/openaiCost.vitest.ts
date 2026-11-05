import { describe, expect, it } from "vitest";

import { calculateRequestCost, openAIPriceFor } from "./calculateRequestCost";

const cost = (model: string, prompt: number, cached = 0, output = 0) =>
  calculateRequestCost("openai", model, {
    promptTokens: prompt,
    completionTokens: output,
    ...(cached ? { promptTokensDetails: { cachedTokens: cached } } : {}),
  });

describe("OpenAI cost", () => {
  it("charges cached input at the cached rate (prompt_tokens includes it)", () => {
    // gpt-5: $1.25 input, $0.125 cached, $10 output per MTok
    const c = cost("gpt-5", 1_000_000, 800_000, 100_000)!;
    expect(c.cost).toBeCloseTo(0.2 * 1.25 + 0.8 * 0.125 + 0.1 * 10, 9);
    expect(c.breakdown).toContain("Cached input: 800,000 tokens");
  });

  it("charges everything at the input rate when nothing was cached", () => {
    expect(cost("gpt-4.1", 1_000_000)!.cost).toBeCloseTo(2, 9);
  });

  it("prices current models from the pricing page", () => {
    expect(openAIPriceFor("gpt-5.4-mini")).toMatchObject({ input: 0.75 });
    expect(openAIPriceFor("gpt-6.1-sol")).toMatchObject({ input: 2 });
    expect(openAIPriceFor("gpt-5-mini-2025-08-07")).toMatchObject({
      input: 0.25,
    });
  });

  it("does not let a short key price a different model", () => {
    // these used to fall through to a shorter prefix
    expect(openAIPriceFor("gpt-5.5")).toMatchObject({ input: 5 });
    expect(openAIPriceFor("gpt-4.1-nano")).toBeUndefined(); // not gpt-4.1's, nor gpt-4's $30
    expect(openAIPriceFor("gpt-5.3")).toBeUndefined(); // not "gpt-5"
  });

  it("gives no price past the short-context limit it has rates for", () => {
    expect(cost("gpt-5.5", 300_000)).toBeNull();
    expect(cost("gpt-5.5", 200_000)).not.toBeNull();
  });

  it("charges cached input at the input rate for models with no cached price", () => {
    expect(cost("gpt-5-pro", 1_000_000, 500_000)!.cost).toBeCloseTo(15, 9);
  });

  it("matches date suffixes but not unlisted variants", () => {
    expect(openAIPriceFor("gpt-4o-2024-08-06")).toMatchObject({ input: 2.5 });
    expect(openAIPriceFor("gpt-4-0613")).toMatchObject({ input: 30 });
    expect(openAIPriceFor("gpt-5-chat-latest")).toBeUndefined();
  });

  it("keeps the older models' prices", () => {
    expect(cost("gpt-4o", 1_000_000)!.cost).toBeCloseTo(2.5, 9);
    expect(cost("gpt-3.5-turbo-0125", 1_000_000)!.cost).toBeCloseTo(0.5, 9);
  });
});
