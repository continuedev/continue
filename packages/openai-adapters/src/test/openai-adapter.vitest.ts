import { describe, vi } from "vitest";
import { createAdapterTests } from "./adapter-test-utils.js";

// Mock the fetch package (not needed for OpenAI but required by the shared test utils)
vi.mock("@continuedev/fetch", async () => {
  const actual = await vi.importActual("@continuedev/fetch");
  return {
    ...actual,
    fetchwithRequestOptions: vi.fn(),
  };
});

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
      authorization: "Bearer test-api-key",
      "content-type": "application/json",
      accept: "application/json",
    },
  });
});
