import { describe } from "vitest";
import { createAdapterTests } from "./adapter-test-utils.js";

describe("OpenAI Adapter Tests", () => {
  createAdapterTests({
    providerName: "openai",
    config: {
      provider: "openai",
      apiKey: "test-api-key",
      apiBase: "https://api.openai.com/v1/",
    },
    expectedApiBase: "https://api.openai.com/v1/",
    customHeaders: {
      "authorization": "Bearer test-api-key",
      "content-type": "application/json",
      "accept": "application/json",
    },
  });
});