import { describe, expect, it } from "vitest";
import {
  applyCrossRegionInference,
  bedrockFinishReason,
  bedrockModelAccessMessage,
  bedrockReasoningFields,
  bedrockSamplingParams,
  bedrockToolsNeedNonStreaming,
  bedrockUsageToCompletionUsage,
  budgetTokensToEffort,
  crossRegionFallbackModelId,
  effortToBudgetTokens,
  getBedrockErrorHint,
  inferenceProfilePrefixForRegion,
  isInvalidModelIdentifierError,
  isStreamingToolUseUnsupportedError,
  resolveBedrockCacheParts,
  ThinkingSplit,
  ThinkingTagSplitter,
  writesThinkingTags,
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

describe("bedrockModelAccessMessage", () => {
  const AWS_TEXT =
    "anthropic.claude-haiku-5-5 is not available for this account. You can explore other available models on Amazon Bedrock. For additional access options, contact AWS Sales at https://aws.amazon.com/contact-us/";
  const denied = (message: string) =>
    Object.assign(new Error(message), { name: "AccessDeniedException" });

  it("says what is wrong and what to do, and keeps AWS's text last", () => {
    const message = bedrockModelAccessMessage(
      denied(AWS_TEXT),
      "us.anthropic.claude-haiku-5-5",
    )!;
    expect(message).toContain("refused us.anthropic.claude-haiku-5-5");
    expect(message).toContain(
      "this AWS account has not been given access to that model",
    );
    expect(message).toContain("tokens-per-minute quota");
    expect(message).toContain("use-case form");
    expect(message).toContain("model agreement");
    expect(message).toContain("https://console.aws.amazon.com/bedrock/");
    expect(message.endsWith(`AWS said: ${AWS_TEXT}`)).toBe(true);
  });

  it("has no blank line, which would hide its start in the chat window", () => {
    expect(bedrockModelAccessMessage(denied(AWS_TEXT), "m")).not.toContain(
      "\n\n",
    );
  });

  it("recognises the error name when it is part of the message", () => {
    expect(
      bedrockModelAccessMessage(
        new Error(`AccessDeniedException: ${AWS_TEXT}`),
        "m",
      ),
    ).toBeDefined();
  });

  it.each([
    "User: arn:aws:iam::1:user/dev is not authorized to perform: bedrock:InvokeModel on resource: arn:aws:bedrock:us-east-1::foundation-model/m",
    "You don't have access to the model with the specified model ID.",
    "Invalid API key",
  ])("leaves another AccessDenied message alone: %s", (message) => {
    expect(bedrockModelAccessMessage(denied(message), "m")).toBeUndefined();
  });

  it("leaves the same wording alone on another kind of error", () => {
    expect(
      bedrockModelAccessMessage(
        Object.assign(new Error(AWS_TEXT), { name: "ValidationException" }),
        "m",
      ),
    ).toBeUndefined();
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

describe("bedrockReasoningFields", () => {
  it("maps effort and budget both ways as the GUI does", () => {
    for (const effort of ["low", "medium", "high"] as const) {
      expect(budgetTokensToEffort(effortToBudgetTokens(effort))).toBe(effort);
    }
  });

  it("sends Claude thinking, adaptive on the models that take it", () => {
    expect(
      bedrockReasoningFields(
        "anthropic.claude-haiku-4-5-20251001-v1:0",
        true,
        1024,
      ),
    ).toEqual({
      additionalModelRequestFields: {
        thinking: { type: "enabled", budget_tokens: 1024 },
      },
      omitMaxTokens: false,
    });
    expect(
      bedrockReasoningFields("us.anthropic.claude-sonnet-4-6", true, 16384)
        .additionalModelRequestFields,
    ).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    });
    expect(
      bedrockReasoningFields("us.anthropic.claude-sonnet-4-6", false, 16384)
        .additionalModelRequestFields,
    ).toEqual({});
  });

  it("sends Nova 2 reasoningConfig and drops maxTokens at high", () => {
    expect(
      bedrockReasoningFields("us.amazon.nova-2-lite-v1:0", true, 16384),
    ).toEqual({
      additionalModelRequestFields: {
        reasoningConfig: { type: "enabled", maxReasoningEffort: "high" },
      },
      omitMaxTokens: true,
    });
    expect(
      bedrockReasoningFields("us.amazon.nova-2-lite-v1:0", true, 1024)
        .omitMaxTokens,
    ).toBe(false);
  });

  it("sends Qwen3 and DeepSeek V3.2 reasoning_effort, none only when explicitly off", () => {
    expect(
      bedrockReasoningFields("qwen.qwen3-32b-v1:0", true, 4096)
        .additionalModelRequestFields,
    ).toEqual({ reasoning_effort: "medium" });
    expect(
      bedrockReasoningFields("deepseek.v3.2", false, 4096)
        .additionalModelRequestFields,
    ).toEqual({ reasoning_effort: "none" });
    expect(
      bedrockReasoningFields("deepseek.v3.2", undefined, 4096)
        .additionalModelRequestFields,
    ).toEqual({});
  });

  it.each([
    "us.deepseek.r1-v1:0",
    "us.amazon.nova-pro-v1:0",
    "amazon.nova-premier-v1:0",
    "us.meta.llama3-3-70b-instruct-v1:0",
    "mistral.mistral-large-3-675b-instruct",
  ])("sends %s nothing", (id) => {
    expect(bedrockReasoningFields(id, true, 16384)).toEqual({
      additionalModelRequestFields: {},
      omitMaxTokens: false,
    });
  });
});

describe("bedrockSamplingParams", () => {
  const claude = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
  it("keeps Claude to temperature when both are set, neither with thinking", () => {
    expect(bedrockSamplingParams(claude, 0.5, 0.9, false)).toEqual({
      temperature: 0.5,
    });
    expect(bedrockSamplingParams(claude, undefined, 0.9, false)).toEqual({
      temperature: undefined,
      topP: 0.9,
    });
    expect(bedrockSamplingParams(claude, 0.5, undefined, true)).toEqual({});
  });
  it("leaves other families alone", () => {
    expect(
      bedrockSamplingParams("us.amazon.nova-2-lite-v1:0", 0.5, 0.9, true),
    ).toEqual({
      temperature: 0.5,
      topP: 0.9,
    });
  });
});

describe("cross-region prefix fallback", () => {
  it("recognises the refusal", () => {
    expect(
      isInvalidModelIdentifierError(
        new Error(
          "ValidationException: The provided model identifier is invalid.",
        ),
      ),
    ).toBe(true);
    expect(isInvalidModelIdentifierError(new Error("Throttling"))).toBe(false);
  });
  it("offers the bare ID only when auto added the prefix", () => {
    expect(
      crossRegionFallbackModelId("qwen.qwen3-32b-v1:0", "auto", "us-east-1"),
    ).toBe("qwen.qwen3-32b-v1:0");
    expect(
      crossRegionFallbackModelId("qwen.qwen3-32b-v1:0", "us", "us-east-1"),
    ).toBeUndefined();
    expect(
      crossRegionFallbackModelId("us.qwen.qwen3-32b-v1:0", "auto", "us-east-1"),
    ).toBeUndefined();
    expect(
      crossRegionFallbackModelId("qwen.qwen3-32b-v1:0", "auto", "sa-east-1"),
    ).toBeUndefined();
  });
});

describe("bedrockFinishReason", () => {
  it.each([
    ["max_tokens", "length"],
    ["tool_use", "tool_calls"],
    ["end_turn", "stop"],
    ["stop_sequence", "stop"],
    ["content_filtered", "content_filter"],
    ["guardrail_intervened", "content_filter"],
    ["new_reason", "stop"],
  ])("%s -> %s", (stop, finish) => {
    expect(bedrockFinishReason(stop)).toBe(finish);
  });
});

describe("tools through Converse for models that cannot stream them", () => {
  it.each([
    "us.meta.llama4-maverick-17b-instruct-v1:0",
    "meta.llama4-scout-17b-instruct-v1:0",
    "qwen.qwen3-32b-v1:0",
    "us.qwen.qwen3-32b-v1:0",
  ])("%s needs the non-streaming route", (id) => {
    expect(bedrockToolsNeedNonStreaming(id)).toBe(true);
  });

  it.each([
    "us.anthropic.claude-haiku-4-5",
    "amazon.nova-pro-v1:0",
    "qwen.qwen3-coder-next",
    "qwen.qwen3-coder-30b-a3b-v1:0",
    "us.meta.llama3-3-70b-instruct-v1:0",
  ])("%s streams tools as usual", (id) => {
    expect(bedrockToolsNeedNonStreaming(id)).toBe(false);
  });

  it("recognises Bedrock's refusal of tools in streaming mode", () => {
    expect(
      isStreamingToolUseUnsupportedError(
        new Error("This model doesn't support tool use in streaming mode."),
      ),
    ).toBe(true);
    expect(isStreamingToolUseUnsupportedError(new Error("boom"))).toBe(false);
  });
});

describe("Nova's <thinking> tags in the text", () => {
  it("applies to Nova Pro, Lite, Micro and Premier, not Nova 2 or others", () => {
    for (const id of [
      "amazon.nova-pro-v1:0",
      "us.amazon.nova-lite-v1:0",
      "amazon.nova-micro-v1:0",
      "us.amazon.nova-premier-v1:0",
    ]) {
      expect(writesThinkingTags(id)).toBe(true);
    }
    expect(writesThinkingTags("us.amazon.nova-2-lite-v1:0")).toBe(false);
    expect(writesThinkingTags("us.anthropic.claude-haiku-4-5")).toBe(false);
  });

  const join = (parts: ThinkingSplit[]) =>
    parts.reduce(
      (acc, p) => ({
        content: acc.content + p.content,
        reasoning: acc.reasoning + p.reasoning,
      }),
      { content: "", reasoning: "" },
    );

  it("lifts the tagged text into reasoning and keeps the rest as content", () => {
    const s = new ThinkingTagSplitter();
    const out = join([
      s.push("<thinking>Let me check the file.</thinking>\n\nThe answer is 4."),
      s.flush(),
    ]);
    expect(out).toEqual({
      reasoning: "Let me check the file.",
      content: "The answer is 4.",
    });
  });

  it("handles a tag split across deltas", () => {
    const s = new ThinkingTagSplitter();
    const out = join([
      s.push("<thin"),
      s.push("king>I rea"),
      s.push("son</thi"),
      s.push("nking>Done"),
      s.flush(),
    ]);
    expect(out).toEqual({ reasoning: "I reason", content: "Done" });
  });

  it("holds back a possible tag start and releases it when it was only text", () => {
    const s = new ThinkingTagSplitter();
    const first = s.push("a <");
    expect(first.content).toBe("a ");
    const rest = join([s.push(" b and c"), s.flush()]);
    expect(rest.content).toBe("< b and c");
    expect(rest.reasoning).toBe("");
  });

  it("flushes a held fragment at the end of the block", () => {
    const s = new ThinkingTagSplitter();
    expect(s.push("text <").content).toBe("text ");
    expect(s.flush()).toEqual({ content: "<", reasoning: "" });
  });

  it("leaves text without tags alone", () => {
    const s = new ThinkingTagSplitter();
    expect(join([s.push("Hello"), s.push(" world"), s.flush()])).toEqual({
      content: "Hello world",
      reasoning: "",
    });
  });
});
