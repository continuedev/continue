import { describe, expect, it } from "vitest";

import type { Usage } from "../..";
import {
  addRequestUsage,
  contextUsage,
  formatCost,
  formatTokens,
  summarizeSessionUsage,
} from "./sessionUsage";

const claudeUsage: Usage = {
  promptTokens: 1000,
  completionTokens: 500,
  promptTokensDetails: { cachedTokens: 4000, cacheWriteTokens: 2000 },
};

describe("addRequestUsage", () => {
  it("splits Claude input into fresh, cache read and cache write", () => {
    const u = addRequestUsage(
      undefined,
      "anthropic",
      "claude-sonnet-4-6",
      claudeUsage,
    );
    const m = u.byModel!["anthropic/claude-sonnet-4-6"];
    expect(m).toMatchObject({
      requests: 1,
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 4000,
      cacheWriteTokens: 2000,
      pricedRequests: 1,
    });
    // 1000*3 + 500*15 + 2000*3.75 + 4000*0.3 per million
    expect(u.totalCost).toBeCloseTo((3000 + 7500 + 7500 + 1200) / 1e6, 9);
    expect(u.lastRequest).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      inputTokens: 7000,
      outputTokens: 500,
    });
  });

  it("does not double count cached tokens that OpenAI includes in prompt tokens", () => {
    const u = addRequestUsage(undefined, "openai", "gpt-4o", {
      promptTokens: 1000,
      completionTokens: 100,
      promptTokensDetails: { cachedTokens: 600 },
    });
    const m = u.byModel!["openai/gpt-4o"];
    expect(m.inputTokens).toBe(400);
    expect(m.cacheReadTokens).toBe(600);
    expect(u.lastRequest?.inputTokens).toBe(1000);
  });

  it("shows tokens only for unknown prices, with no invented cost", () => {
    const u = addRequestUsage(undefined, "ollama", "llama3", {
      promptTokens: 300,
      completionTokens: 50,
    });
    expect(u.totalCost).toBe(0);
    const s = summarizeSessionUsage(u);
    expect(s.cost).toBeUndefined();
    expect(s.costIsPartial).toBe(false);
    expect(s.inputTokens).toBe(300);
    expect(s.outputTokens).toBe(50);
  });

  it("marks cost partial when only some requests were priced", () => {
    let u = addRequestUsage(
      undefined,
      "anthropic",
      "claude-sonnet-4-6",
      claudeUsage,
    );
    u = addRequestUsage(u, "ollama", "llama3", {
      promptTokens: 10,
      completionTokens: 5,
    });
    const s = summarizeSessionUsage(u);
    expect(s.requests).toBe(2);
    expect(s.cost).toBeGreaterThan(0);
    expect(s.costIsPartial).toBe(true);
  });

  it("accumulates per model and does not mutate its input", () => {
    const first = addRequestUsage(undefined, "openai", "gpt-4o", {
      promptTokens: 10,
      completionTokens: 1,
    });
    const frozen = JSON.stringify(first);
    const second = addRequestUsage(first, "openai", "gpt-4o", {
      promptTokens: 20,
      completionTokens: 2,
    });
    expect(JSON.stringify(first)).toBe(frozen);
    expect(second.byModel!["openai/gpt-4o"].requests).toBe(2);
    expect(second.promptTokens).toBe(30);
    expect(second.completionTokens).toBe(3);
  });
});

describe("contextUsage", () => {
  const u = addRequestUsage(
    undefined,
    "anthropic",
    "claude-sonnet-4-6",
    claudeUsage,
  );
  it("is the latest request against the window", () => {
    expect(contextUsage(u, 200000)).toEqual({
      tokens: 7500,
      limit: 200000,
      fraction: 7500 / 200000,
    });
  });
  it("is undefined without usage or a window", () => {
    expect(contextUsage(undefined, 200000)).toBeUndefined();
    expect(contextUsage(u, undefined)).toBeUndefined();
  });
  it("caps the fraction at 1", () => {
    expect(contextUsage(u, 1000)?.fraction).toBe(1);
  });
});

describe("formatting", () => {
  it("formats cost", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(0.0004)).toBe("<$0.01");
    expect(formatCost(1.234)).toBe("$1.23");
  });
  it("formats tokens", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(1234)).toBe("1.2k");
    expect(formatTokens(45678)).toBe("46k");
    expect(formatTokens(2_500_000)).toBe("2.5M");
  });
});
