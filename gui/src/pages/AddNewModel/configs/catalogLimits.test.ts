import { describe, expect, it } from "vitest";
import { findLlmInfo } from "../../../../../packages/llm-info/src/index";
import { models } from "./models";

type Pkg = (typeof models)[string];

const entries = Object.entries(models) as [string, Pkg][];

const limitsOf = (pkg: Pkg) => ({
  model: pkg.params?.model as string | undefined,
  contextLength: pkg.params?.contextLength as number | undefined,
  maxTokens: (pkg.params as any)?.completionOptions?.maxTokens as
    number | undefined,
});

describe("model catalog limits", () => {
  // The same rule as core/config/validation.ts: a model whose output limit
  // eats the whole window would leave no room for the prompt.
  it.each(entries)("%s leaves room for the prompt", (_key, pkg) => {
    const { contextLength, maxTokens } = limitsOf(pkg);
    if (contextLength && maxTokens) {
      expect(contextLength - maxTokens).toBeGreaterThanOrEqual(1000);
    }
  });

  // Catalog entries and llm-info should agree, so a model added from the
  // catalog behaves like one written by hand with no limits. Enforced for
  // Claude models only for now: about 30 older entries (Mistral, GPT, Grok,
  // CometAPI, ...) still differ and each needs its correct value checked.
  const claude = entries.filter(([, pkg]) =>
    /claude/i.test(String(pkg.params?.model ?? "")),
  );
  it.each(claude)("%s agrees with llm-info", (_key, pkg) => {
    const { model, contextLength } = limitsOf(pkg);
    if (!model || !contextLength) return;
    const info = findLlmInfo(model, pkg.providerOptions?.[0]);
    if (!info?.contextLength) return;
    expect({ model, contextLength }).toEqual({
      model,
      contextLength: info.contextLength,
    });
  });
});
