import { PERPLEXITY_INTEGRATION_HEADER } from "@continuedev/openai-adapters";
import { describe, expect, it } from "vitest";

import { createOpenAISubclassTests } from "./test-utils/openai-test-utils.js";
import Perplexity from "./Perplexity.js";

createOpenAISubclassTests(Perplexity, {
  providerName: "perplexity",
  defaultApiBase: "https://api.perplexity.ai/",
});

describe("perplexity attribution headers", () => {
  it("sets the Perplexity integration attribution header", () => {
    const perplexity = new Perplexity({
      apiKey: "test-api-key",
      model: "sonar",
    });

    const headers = perplexity["_getHeaders"]();

    expect(headers[PERPLEXITY_INTEGRATION_HEADER]).toMatch(/^continue\//);
  });
});
