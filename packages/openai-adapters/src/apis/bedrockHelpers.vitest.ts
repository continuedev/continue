import { describe, expect, it } from "vitest";
import {
  applyCrossRegionInference,
  bedrockUsageToCompletionUsage,
  getBedrockErrorHint,
  inferenceProfilePrefixForRegion,
  resolveBedrockCacheParts,
} from "./bedrockHelpers.js";

describe("inferenceProfilePrefixForRegion", () => {
  it.each([
    ["us-east-1", "us"],
    ["us-west-2", "us"],
    ["us-gov-west-1", "us-gov"],
    ["eu-central-1", "eu"],
    ["ap-southeast-2", "apac"],
    ["sa-east-1", undefined],
    [undefined, undefined],
  ])("%s -> %s", (region, expected) => {
    expect(inferenceProfilePrefixForRegion(region)).toBe(expected);
  });
});

describe("applyCrossRegionInference", () => {
  const model = "anthropic.claude-sonnet-4-20250514-v1:0";

  it("is a no-op when unset", () => {
    expect(applyCrossRegionInference(model, undefined, "us-east-1")).toBe(
      model,
    );
  });

  it("derives the prefix from the region with 'auto'", () => {
    expect(applyCrossRegionInference(model, "auto", "eu-west-1")).toBe(
      `eu.${model}`,
    );
  });

  it("uses an explicit prefix, including global", () => {
    expect(applyCrossRegionInference(model, "global", "us-east-1")).toBe(
      `global.${model}`,
    );
  });

  it("leaves 'auto' alone for regions without a known prefix", () => {
    expect(applyCrossRegionInference(model, "auto", "sa-east-1")).toBe(model);
  });

  it("does not double-prefix existing profile IDs", () => {
    expect(applyCrossRegionInference(`us.${model}`, "eu", "eu-west-1")).toBe(
      `us.${model}`,
    );
  });

  it("leaves ARNs untouched", () => {
    const arn =
      "arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude";
    expect(applyCrossRegionInference(arn, "auto", "us-east-1")).toBe(arn);
  });
});

describe("getBedrockErrorHint", () => {
  it("suggests aws sso login with the profile for SSO expiry", () => {
    const hint = getBedrockErrorHint(
      new Error("The SSO session associated with this profile has expired"),
      { profile: "work" },
    );
    expect(hint).toContain("aws sso login --profile work");
  });

  it("explains how to configure credentials when none are found", () => {
    const e = Object.assign(
      new Error("Could not load credentials from any providers"),
      {
        name: "CredentialsProviderError",
      },
    );
    expect(getBedrockErrorHint(e, {})).toContain("AWS_BEARER_TOKEN_BEDROCK");
  });

  it("points at crossRegionInference for on-demand throughput errors", () => {
    const e = Object.assign(
      new Error(
        "Invocation of model ID anthropic.claude with on-demand throughput isn't supported. Retry with an inference profile",
      ),
      { name: "ValidationException" },
    );
    expect(getBedrockErrorHint(e, {})).toContain("crossRegionInference");
  });

  it("points at model access for AccessDenied on a model", () => {
    const e = Object.assign(
      new Error(
        "You don't have access to the model with the specified model ID.",
      ),
      { name: "AccessDeniedException" },
    );
    expect(getBedrockErrorHint(e, { region: "us-west-2" })).toContain(
      "us-west-2",
    );
  });

  it("returns undefined for unrelated errors", () => {
    expect(getBedrockErrorHint(new Error("boom"), {})).toBeUndefined();
  });
});

describe("bedrockUsageToCompletionUsage", () => {
  it("maps the cache fields to the names the Anthropic adapter uses", () => {
    expect(
      bedrockUsageToCompletionUsage({
        inputTokens: 10,
        outputTokens: 20,
        cacheReadInputTokens: 300,
        cacheWriteInputTokens: 40,
      }),
    ).toEqual({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
      prompt_tokens_details: {
        cached_tokens: 300,
        cache_read_tokens: 300,
        cache_write_tokens: 40,
      },
    });
  });

  it("does not add cache tokens to the prompt count", () => {
    const u = bedrockUsageToCompletionUsage({
      inputTokens: 1,
      cacheReadInputTokens: 99_999,
    });
    expect(u.prompt_tokens).toBe(1);
    expect(u.total_tokens).toBe(1);
  });

  it("treats an empty usage as zeros", () => {
    expect(bedrockUsageToCompletionUsage({})).toMatchObject({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    });
  });
});

describe("resolveBedrockCacheParts", () => {
  const all = { tools: true, system: true, conversation: true };
  const none = { tools: false, system: false, conversation: false };

  it.each([
    [undefined, undefined, true, none],
    [true, undefined, true, all],
    [true, undefined, false, { ...all, system: false }],
    [false, { cacheConversation: true }, true, none],
    [
      undefined,
      { cacheSystemMessage: true, cacheConversation: true },
      true,
      { tools: false, system: true, conversation: true },
    ],
    [undefined, { cacheSystemMessage: true }, false, none],
  ] as const)("requested=%s behavior=%j hasSystem=%s", (r, b, s, expected) => {
    expect(resolveBedrockCacheParts(r, b, s)).toEqual(expected);
  });
});
