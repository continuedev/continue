import { describe, expect, test, vi } from "vitest";
import type { ChatCompletionCreateParams } from "openai/resources/index";
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
});

describe("OpenAI modifyChatBody", () => {
  const api = new OpenAIApi({
    provider: "openai",
    apiKey: "test-api-key",
    apiBase: "https://api.openai.com/v1/",
  });

  test("omits stop for gpt-5 models", () => {
    const body: ChatCompletionCreateParams = {
      model: "gpt-5-nano",
      messages: [{ role: "user", content: "hello" }],
      stop: ["\n"],
      stream: true,
    };
    expect(api.modifyChatBody(body).stop).toBeUndefined();
  });

  test("keeps stop for other models", () => {
    const body: ChatCompletionCreateParams = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      stop: ["\n"],
      stream: true,
    };
    expect(api.modifyChatBody(body).stop).toEqual(["\n"]);
  });
});
