import { describe, expect, it } from "vitest";

import ClawRouter from "./ClawRouter";

describe("ClawRouter", () => {
  it("should have correct provider name", () => {
    expect(ClawRouter.providerName).toBe("clawrouter");
  });

  it("should have correct default options", () => {
    expect(ClawRouter.defaultOptions.apiBase).toBe("http://localhost:8402/v1/");
    expect(ClawRouter.defaultOptions.model).toBe("blockrun/auto");
    expect(ClawRouter.defaultOptions.useLegacyCompletionsEndpoint).toBe(false);
  });

  it("should support reasoning fields", () => {
    const clawRouter = new ClawRouter({
      model: "blockrun/auto",
    });

    // ClawRouter routes to models that may support reasoning
    expect(clawRouter["supportsReasoningField"]).toBe(true);
    expect(clawRouter["supportsReasoningDetailsField"]).toBe(true);
  });

  it("should cap stop sequences at 4, as the OpenAI models it routes to require", () => {
    const clawRouter = new ClawRouter({
      model: "blockrun/auto",
    });

    expect(clawRouter["getMaxStopWords"]()).toBe(4);
  });

  it("should include Continue User-Agent header", () => {
    const clawRouter = new ClawRouter({
      model: "blockrun/auto",
    });

    const headers = clawRouter["_getHeaders"]();

    expect(headers["User-Agent"]).toMatch(/^Continue\//);
    expect(headers["X-Continue-Provider"]).toBe("clawrouter");
  });

  it("should accept all routing profiles", () => {
    const profiles = [
      "blockrun/auto",
      "blockrun/eco",
      "blockrun/premium",
      "blockrun/free",
    ];

    for (const profile of profiles) {
      const clawRouter = new ClawRouter({ model: profile });
      expect(clawRouter.model).toBe(profile);
    }
  });
});
