import { describe, expect, it } from "vitest";

import {
  getTemplateForModel,
  isBedrockChatOnlyModel,
} from "../AutocompleteTemplate";

function isHoleFiller(model: string) {
  const { template } = getTemplateForModel(model);
  return (
    typeof template === "function" &&
    template("a", "b", "f.ts", "r", "typescript", [], []).includes(
      "{{FILL_HERE}}",
    )
  );
}

describe("autocomplete template for Bedrock model IDs", () => {
  it.each([
    "us.amazon.nova-micro-v1:0",
    "amazon.nova-lite-v1:0",
    "mistral.devstral-2-123b",
    "mistral.ministral-3-8b-instruct",
    "openai.gpt-oss-20b-1:0",
    "deepseek.v3-v1:0",
    "us.meta.llama4-maverick-17b-instruct-v1:0",
    "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  ])("uses the hole-filler prompt for %s", (model) => {
    expect(isBedrockChatOnlyModel(model)).toBe(true);
    expect(isHoleFiller(model)).toBe(true);
  });

  it("uses the hole-filler prompt for Bedrock's Qwen coder models", () => {
    // Their FIM answer comes wrapped in a ``` fence, which is a stop token.
    expect(isBedrockChatOnlyModel("qwen.qwen3-coder-30b-a3b-v1:0")).toBe(true);
    expect(isHoleFiller("qwen.qwen3-coder-30b-a3b-v1:0")).toBe(true);
  });

  it.each([
    "codestral-latest",
    "deepseek-coder:6.7b",
    "qwen2.5-coder:1.5b",
    "mistral:7b",
    "starcoder2:3b",
  ])("does not change the template for %s", (model) => {
    expect(isBedrockChatOnlyModel(model)).toBe(false);
  });
});

describe("autocomplete template for Qwen 3 chat models", () => {
  it.each(["qwen3.8-flash-next-nvfp4-nvfp4", "Qwen3.6-35B-A3B", "qwen3:8b"])(
    "uses the hole-filler prompt for %s",
    (model) => {
      expect(isHoleFiller(model)).toBe(true);
    },
  );

  it.each(["qwen3-coder:30b", "qwen2.5-coder:1.5b-base"])(
    "keeps the FIM prompt for the coder model %s",
    (model) => {
      expect(isHoleFiller(model)).toBe(false);
    },
  );
});
