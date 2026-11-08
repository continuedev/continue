import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import * as core from "./bedrockHelpers";

// Loaded at run time from a path held in a variable, not with a static import,
// for the reason given in bedrockOneHourCache.vitest.ts.
const ADAPTER_HELPERS = pathToFileURL(
  resolve(
    __dirname,
    "../../../packages/openai-adapters/src/apis/bedrockHelpers.ts",
  ),
).href;
let adapter: typeof core;

beforeAll(async () => {
  adapter = await import(/* @vite-ignore */ ADAPTER_HELPERS);
});

/**
 * The per-family request rules exist twice: here in core, which the chat
 * window imports, and in the Bedrock adapter, which the CLI uses and which
 * core cannot be imported into. These fail if the two disagree on any case
 * below, so a family added to one has to be added to the other.
 */
const MODELS = [
  "anthropic.claude-haiku-4-5-20251001-v1:0",
  "us.anthropic.claude-sonnet-4-6",
  "global.anthropic.claude-opus-5-5",
  "us.amazon.nova-2-lite-v1:0",
  "us.amazon.nova-2-pro-v1:0",
  "us.amazon.nova-pro-v1:0",
  "amazon.nova-lite-v1:0",
  "amazon.nova-premier-v1:0",
  "qwen.qwen3-32b-v1:0",
  "us.qwen.qwen3-coder-30b-a3b-v1:0",
  "deepseek.v3.2",
  "us.deepseek.r1-v1:0",
  "us.meta.llama3-3-70b-instruct-v1:0",
  "mistral.mistral-large-3-675b-instruct",
  "openai.gpt-oss-120b-1:0",
  "",
];
const REASONING = [undefined, false, true] as const;
const BUDGETS = [1024, 4096, 16384];

describe("bedrockReasoningFields exists in core and in the adapter", () => {
  it.each(MODELS)("agrees on %j", (id) => {
    for (const reasoning of REASONING) {
      for (const budget of BUDGETS) {
        expect(adapter.bedrockReasoningFields(id, reasoning, budget)).toEqual(
          core.bedrockReasoningFields(id, reasoning, budget),
        );
      }
    }
  });

  it("covers Claude, Nova 2, the reasoning_effort models and silence, so it cannot pass emptily", () => {
    const shapes = new Set(
      MODELS.map((id) =>
        Object.keys(
          core.bedrockReasoningFields(id, true, 16384)
            .additionalModelRequestFields,
        ).join(","),
      ),
    );
    expect([...shapes].sort()).toEqual([
      "",
      "reasoningConfig",
      "reasoning_effort",
      "thinking",
      "thinking,output_config",
    ]);
  });

  it("sends Qwen3 and DeepSeek V3.2 none only when reasoning is explicitly off", () => {
    expect(
      core.bedrockReasoningFields("qwen.qwen3-32b-v1:0", false, 1024)
        .additionalModelRequestFields,
    ).toEqual({ reasoning_effort: "none" });
    expect(
      core.bedrockReasoningFields("deepseek.v3.2", undefined, 1024)
        .additionalModelRequestFields,
    ).toEqual({});
  });

  it("omits maxTokens only for Nova 2 at high effort", () => {
    const nova = "us.amazon.nova-2-lite-v1:0";
    expect(core.bedrockReasoningFields(nova, true, 16384).omitMaxTokens).toBe(
      true,
    );
    expect(core.bedrockReasoningFields(nova, true, 4096).omitMaxTokens).toBe(
      false,
    );
    expect(
      core.bedrockReasoningFields("anthropic.claude-haiku-4-5", true, 16384)
        .omitMaxTokens,
    ).toBe(false);
  });

  it("sends DeepSeek R1 and Nova Pro nothing, which is all they accept", () => {
    for (const id of ["us.deepseek.r1-v1:0", "us.amazon.nova-pro-v1:0"]) {
      expect(
        core.bedrockReasoningFields(id, true, 16384)
          .additionalModelRequestFields,
      ).toEqual({});
    }
  });
});

describe("bedrockSamplingParams exists in core and in the adapter", () => {
  const CASES: Array<[number | undefined, number | undefined, boolean]> = [
    [0.5, 0.9, false],
    [0.5, undefined, false],
    [undefined, 0.9, false],
    [0.5, 0.9, true],
    [undefined, undefined, true],
  ];
  it.each(MODELS)("agrees on %j", (id) => {
    for (const [t, p, r] of CASES) {
      expect(adapter.bedrockSamplingParams(id, t, p, r)).toEqual(
        core.bedrockSamplingParams(id, t, p, r),
      );
    }
  });

  it("keeps Claude to one of the two, and neither with thinking", () => {
    const claude = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
    expect(core.bedrockSamplingParams(claude, 0.5, 0.9, false)).toEqual({
      temperature: 0.5,
    });
    expect(core.bedrockSamplingParams(claude, undefined, 0.9, false)).toEqual({
      temperature: undefined,
      topP: 0.9,
    });
    expect(core.bedrockSamplingParams(claude, 0.5, 0.9, true)).toEqual({});
    expect(
      core.bedrockSamplingParams("us.amazon.nova-2-lite-v1:0", 0.5, 0.9, true),
    ).toEqual({ temperature: 0.5, topP: 0.9 });
  });
});

describe("the other per-family rules agree between the copies", () => {
  it.each(MODELS)("cache point placement and marker leak on %j", (id) => {
    expect(adapter.bedrockCachePointAfterTextOnly(id)).toBe(
      core.bedrockCachePointAfterTextOnly(id),
    );
    expect(adapter.leaksDsmlMarker(id)).toBe(core.leaksDsmlMarker(id));
  });

  it("lets Claude, and only Claude, take a cache point after a toolResult", () => {
    expect(
      core.bedrockCachePointAfterTextOnly("anthropic.claude-sonnet-4-6"),
    ).toBe(false);
    expect(
      core.bedrockCachePointAfterTextOnly("us.amazon.nova-2-lite-v1:0"),
    ).toBe(true);
  });

  it.each([
    "max_tokens",
    "tool_use",
    "end_turn",
    "stop_sequence",
    "content_filtered",
    "guardrail_intervened",
    "something_new",
  ])("maps stop reason %s the same way", (reason) => {
    expect(adapter.bedrockFinishReason(reason)).toBe(
      core.bedrockFinishReason(reason),
    );
  });

  it("maps truncation to length and a tool call to tool_calls", () => {
    expect(core.bedrockFinishReason("max_tokens")).toBe("length");
    expect(core.bedrockFinishReason("tool_use")).toBe("tool_calls");
    expect(core.bedrockFinishReason("end_turn")).toBe("stop");
    expect(core.bedrockFinishReason("stop_sequence")).toBe("stop");
    expect(core.bedrockFinishReason("content_filtered")).toBe("content_filter");
  });

  it("recognises the invalid-identifier refusal and the bare ID to retry with", () => {
    const refusal = new Error(
      "ValidationException: The provided model identifier is invalid.",
    );
    expect(core.isInvalidModelIdentifierError(refusal)).toBe(true);
    expect(adapter.isInvalidModelIdentifierError(refusal)).toBe(true);
    expect(core.isInvalidModelIdentifierError(new Error("throttled"))).toBe(
      false,
    );
    for (const copy of [core, adapter]) {
      expect(
        copy.crossRegionFallbackModelId(
          "qwen.qwen3-32b-v1:0",
          "auto",
          "us-east-1",
        ),
      ).toBe("qwen.qwen3-32b-v1:0");
      // An explicit prefix, an ID that already has one, or no setting: nothing to retry
      expect(
        copy.crossRegionFallbackModelId(
          "qwen.qwen3-32b-v1:0",
          "us",
          "us-east-1",
        ),
      ).toBeUndefined();
      expect(
        copy.crossRegionFallbackModelId(
          "us.qwen.qwen3-32b-v1:0",
          "auto",
          "us-east-1",
        ),
      ).toBeUndefined();
      expect(
        copy.crossRegionFallbackModelId(
          "qwen.qwen3-32b-v1:0",
          undefined,
          "us-east-1",
        ),
      ).toBeUndefined();
    }
  });
});

describe("holdBackDsmlMarker", () => {
  const marker = core.DEEPSEEK_DSML_MARKER;

  it("is the fragment DeepSeek V3.2 leaks, with fullwidth bars", () => {
    expect(marker).toBe("<｜DSML｜function_calls");
    expect(adapter.DEEPSEEK_DSML_MARKER).toBe(marker);
  });

  it("emits plain text and holds nothing", () => {
    expect(core.holdBackDsmlMarker("hello world")).toEqual({
      emit: "hello world",
      hold: "",
    });
  });

  it("holds a tail that could still become the marker", () => {
    expect(core.holdBackDsmlMarker("done <｜DS")).toEqual({
      emit: "done ",
      hold: "<｜DS",
    });
    expect(core.holdBackDsmlMarker("a <")).toEqual({ emit: "a ", hold: "<" });
  });

  it("holds the marker and what follows it", () => {
    expect(core.holdBackDsmlMarker(`I will echo it.${marker}>`)).toEqual({
      emit: "I will echo it.",
      hold: `${marker}>`,
    });
  });

  it("drops a held marker at the end of the block and keeps anything else", () => {
    expect(core.flushDsmlHold(`${marker}>`)).toBe("");
    expect(core.flushDsmlHold("<")).toBe("<");
    for (const text of ["a <", `x${marker}`, "plain", "<｜DS"]) {
      expect(adapter.holdBackDsmlMarker(text)).toEqual(
        core.holdBackDsmlMarker(text),
      );
    }
  });
});
