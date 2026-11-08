import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { bedrockCachePointFields as coreCopy } from "./bedrockHelpers";

// Loaded at run time from a path held in a variable, not with a static import,
// for the reason given in bedrockOneHourCache.vitest.ts.
const ADAPTER_HELPERS = pathToFileURL(
  resolve(
    __dirname,
    "../../../packages/openai-adapters/src/apis/bedrockHelpers.ts",
  ),
).href;
let adapterCopy: (modelId: string) => unknown;

beforeAll(async () => {
  const mod = await import(/* @vite-ignore */ ADAPTER_HELPERS);
  adapterCopy = mod.bedrockCachePointFields;
});

/**
 * Which request fields take a cache point per model exists twice: here in
 * core, which the chat window imports, and in the Bedrock adapter, which the
 * CLI uses and which core cannot be imported into. This fails if the two
 * disagree on any model below, so a model added to one has to be added to the
 * other.
 */
const MODELS = [
  "anthropic.claude-haiku-4-5-20251001-v1:0",
  "us.anthropic.claude-sonnet-4-6",
  "global.anthropic.claude-sonnet-5-5",
  "anthropic.claude-3-haiku-20240307-v1:0",
  "claude-sonnet-4.6",
  "amazon.nova-2-lite-v1:0",
  "us.amazon.nova-2-lite-v1:0",
  "amazon.nova-pro-v1:0",
  "us.amazon.nova-pro-v1:0",
  "amazon.nova-lite-v1:0",
  "amazon.nova-micro-v1:0",
  "amazon.nova-premier-v1:0",
  "us.amazon.nova-2-pro-v1:0",
  "us.amazon.nova-2-omni-v1:0",
  "openai.gpt-6.1-sol",
  "openai.gpt-oss-120b-1:0",
  "xai.grok-4",
  "",
];

describe("the cache point field table exists in core and in the adapter", () => {
  it.each(MODELS)("agrees on %j", (id) => {
    expect(adapterCopy(id)).toEqual(coreCopy(id));
  });

  it("lists Claude, Nova and a model with no cache points, so it cannot pass emptily", () => {
    const answers = MODELS.map((id) => JSON.stringify(coreCopy(id)));
    expect(new Set(answers).size).toBe(3);
  });

  it("gives Nova the system prompt and messages, not the tools", () => {
    expect(coreCopy("us.amazon.nova-2-lite-v1:0")).toEqual({
      tools: false,
      system: true,
      conversation: true,
    });
    expect(coreCopy("amazon.nova-premier-v1:0")).toBeUndefined();
  });
});
