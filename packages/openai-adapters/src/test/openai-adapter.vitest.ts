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

  it("includes streaming usage by default unless stream options are disabled", () => {
    const body = {
      model: "gpt-4",
      messages: [{ role: "user" as const, content: "hello" }],
      stream: true as const,
    };
    const defaultApi = new OpenAIApi({
      provider: "openai",
      apiKey: "test-api-key",
    });
    const disabledApi = new OpenAIApi({
      provider: "openai",
      apiKey: "test-api-key",
      streamOptions: false,
    });

    expect(defaultApi.modifyChatBody({ ...body })).toHaveProperty(
      "stream_options.include_usage",
      true,
    );
    expect(disabledApi.modifyChatBody({ ...body })).not.toHaveProperty(
      "stream_options",
    );
  });
});
