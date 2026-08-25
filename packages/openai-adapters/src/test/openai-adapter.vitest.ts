import { describe, expect, it, vi } from "vitest";
import { OpenAIApi } from "../apis/OpenAI.js";
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

  describe("shouldUseResponsesEndpoint", () => {
    it("should use responses endpoint on official apiBase for responses models", () => {
      const api = new OpenAIApi({
        provider: "openai",
        apiKey: "test",
        apiBase: "https://api.openai.com/v1/",
      });
      expect((api as any).shouldUseResponsesEndpoint("gpt-5")).toBe(true);
      expect((api as any).shouldUseResponsesEndpoint("o3-mini")).toBe(true);
      expect((api as any).shouldUseResponsesEndpoint("gpt-4o")).toBe(false);
    });

    it("should not use responses endpoint on custom apiBase by default", () => {
      const api = new OpenAIApi({
        provider: "openai",
        apiKey: "test",
        apiBase: "https://custom-openai-proxy.com/v1/",
      });
      expect((api as any).shouldUseResponsesEndpoint("gpt-5")).toBe(false);
      expect((api as any).shouldUseResponsesEndpoint("o3-mini")).toBe(false);
    });

    it("should use responses endpoint on custom apiBase if useResponsesApi is true", () => {
      const api = new OpenAIApi({
        provider: "openai",
        apiKey: "test",
        apiBase: "https://custom-openai-proxy.com/v1/",
        useResponsesApi: true,
      });
      expect((api as any).shouldUseResponsesEndpoint("gpt-5")).toBe(true);
      expect((api as any).shouldUseResponsesEndpoint("o3-mini")).toBe(true);
      expect((api as any).shouldUseResponsesEndpoint("gpt-4o")).toBe(false);
    });

    it("should not use responses endpoint when useResponsesApi is false", () => {
      const api = new OpenAIApi({
        provider: "openai",
        apiKey: "test",
        apiBase: "https://api.openai.com/v1/",
        useResponsesApi: false,
      });
      expect((api as any).shouldUseResponsesEndpoint("gpt-5")).toBe(false);
    });
  });
});
