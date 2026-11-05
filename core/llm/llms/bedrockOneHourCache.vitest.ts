import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { bedrockSupportsOneHourCache as coreCopy } from "./bedrockHelpers";

// Loaded at run time from a path held in a variable, not with a static import:
// core's tsc build compiles every .ts file under core/, and a static import of
// a file in packages/ pulls it into that build, which moves the output root up
// a directory and leaves core/dist/index.js where the CLI cannot find it.
// By path, not by package name: core resolves @continuedev/openai-adapters to
// a built copy, which may be older than the source this test must compare.
const ADAPTER_HELPERS = pathToFileURL(
  resolve(
    __dirname,
    "../../../packages/openai-adapters/src/apis/bedrockHelpers.ts",
  ),
).href;
let adapterCopy: (modelId: string) => boolean;

beforeAll(async () => {
  const mod = await import(/* @vite-ignore */ ADAPTER_HELPERS);
  adapterCopy = mod.bedrockSupportsOneHourCache;
});

/**
 * The 1-hour allowlist exists twice: here in core, which the chat window
 * imports, and in the Bedrock adapter, which the CLI uses and which core cannot
 * be imported into. This fails if the two disagree on any model below, so a
 * model added to one list has to be added to the other.
 */
const MODELS = [
  "anthropic.claude-haiku-4-5-20251001-v1:0",
  "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  "global.anthropic.claude-haiku-5-5",
  "anthropic.claude-sonnet-4-6",
  "us.anthropic.claude-sonnet-4-6",
  "eu.anthropic.claude-sonnet-5",
  "global.anthropic.claude-sonnet-5-5",
  "anthropic.claude-sonnet-4-5-20250929-v1:0",
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "anthropic.claude-sonnet-4-20250514-v1:0",
  "anthropic.claude-opus-4-20250514-v1:0",
  "anthropic.claude-opus-4-1-20250805-v1:0",
  "anthropic.claude-opus-4-5-20251101-v1:0",
  "us.anthropic.claude-opus-4-6",
  "us.anthropic.claude-opus-4-7",
  "us.anthropic.claude-opus-4-8",
  "us.anthropic.claude-opus-5",
  "global.anthropic.claude-opus-5-5",
  "us.anthropic.claude-fable-5-1",
  "us.anthropic.claude-mythos-5",
  "anthropic.claude-3-7-sonnet-20250219-v1:0",
  "anthropic.claude-3-5-haiku-20241022-v1:0",
  "anthropic.claude-3-haiku-20240307-v1:0",
  "claude-sonnet-4.6",
  "us.amazon.nova-pro-v1:0",
  "openai.gpt-oss-120b-1:0",
  "xai.grok-4",
  "",
];

describe("the 1-hour cache allowlist exists in core and in the adapter", () => {
  it.each(MODELS)("agrees on %j", (id) => {
    expect(adapterCopy(id)).toBe(coreCopy(id));
  });

  it("lists at least one model as accepted, so the test cannot pass emptily", () => {
    expect(MODELS.filter((id) => coreCopy(id)).length).toBeGreaterThan(5);
  });
});
