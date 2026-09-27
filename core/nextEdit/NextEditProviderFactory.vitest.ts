import { describe, expect, it } from "vitest";
import { NextEditProviderFactory } from "./NextEditProviderFactory.js";
import { GenericNextEditProvider } from "./providers/GenericNextEditProvider.js";
import { MercuryCoderProvider } from "./providers/MercuryCoderNextEditProvider.js";

describe("NextEditProviderFactory", () => {
  it("uses the Mercury provider for Mercury Coder", () => {
    expect(
      NextEditProviderFactory.createProvider("inception/mercury-coder"),
    ).toBeInstanceOf(MercuryCoderProvider);
  });

  it("uses the generic provider for configured compatible models", () => {
    expect(
      NextEditProviderFactory.createProvider("provider/diffusion-model"),
    ).toBeInstanceOf(GenericNextEditProvider);
  });

  it("preserves code indentation when removing Markdown fences", () => {
    const provider = new GenericNextEditProvider("provider/diffusion-model");

    expect(
      provider.extractCompletion("```typescript\n  return value;\n```"),
    ).toBe("  return value;");
  });
});
