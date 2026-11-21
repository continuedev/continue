import { describe, expect, it } from "vitest";

import CrowLLM from "./CrowLLM";

describe("CrowLLM", () => {
  it("should have correct provider name", () => {
    expect(CrowLLM.providerName).toBe("crowllm");
  });

  it("should have correct default options", () => {
    expect(CrowLLM.defaultOptions.apiBase).toBe("https://crowllm.com/v1/");
    expect(CrowLLM.defaultOptions.model).toBe("deepseek-v4-flash");
    expect(CrowLLM.defaultOptions.useLegacyCompletionsEndpoint).toBe(false);
  });

  it("should keep reasoning fields on the wire", () => {
    const crowllm = new CrowLLM({
      model: "glm-5.3",
    });

    expect(crowllm["supportsReasoningField"]).toBe(true);
  });
});
