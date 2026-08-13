import { describe, expect, it } from "vitest";

import LiteLLM from "./LiteLLM";

describe("LiteLLM", () => {
  it("should have correct provider name", () => {
    expect(LiteLLM.providerName).toBe("litellm");
  });

  it("should default to the local LiteLLM proxy endpoint", () => {
    expect(LiteLLM.defaultOptions.apiBase).toBe("http://localhost:4000/v1/");
    expect(LiteLLM.defaultOptions.useLegacyCompletionsEndpoint).toBe(false);
  });

  it("should support reasoning fields", () => {
    const litellm = new LiteLLM({ model: "gpt-4o-mini" });

    expect(litellm["supportsReasoningField"]).toBe(true);
    expect(litellm["supportsReasoningDetailsField"]).toBe(true);
  });

  it("should honor a custom apiBase (remote proxy)", () => {
    const litellm = new LiteLLM({
      model: "claude-3-5-sonnet",
      apiBase: "https://litellm.example.com/v1/",
    });

    expect(litellm.apiBase).toBe("https://litellm.example.com/v1/");
  });

  it("should route arbitrary proxy model names", () => {
    const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-2.5-flash"];
    for (const model of models) {
      const litellm = new LiteLLM({ model });
      expect(litellm.model).toBe(model);
    }
  });
});
