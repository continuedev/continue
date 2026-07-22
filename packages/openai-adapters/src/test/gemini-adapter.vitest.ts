import { afterEach, describe, expect, it, vi } from "vitest";

const generateContentStream = vi.fn();
const GoogleGenAIMock = vi.fn().mockImplementation(() => ({
  models: {
    generateContentStream,
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: GoogleGenAIMock,
}));

vi.mock("../util/nativeFetch.js", () => ({
  withNativeFetch: (fn: () => unknown) => fn(),
}));

describe("GeminiApi", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes custom headers and apiBase through GoogleGenAI httpOptions", async () => {
    const { GeminiApi } = await import("../apis/Gemini.js");

    new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
      apiBase:
        "https://example.com/v1/streaming-models/locations/europe-west4/publishers/google",
      requestOptions: {
        timeout: 10000,
        headers: {
          "x-api-key": "secondary-api-key",
          "Content-Type": "application/json",
        },
      },
    });

    expect(GoogleGenAIMock).toHaveBeenCalledWith({
      apiKey: "primary-api-key",
      httpOptions: {
        apiVersion: "",
        baseUrl:
          "https://example.com/v1/streaming-models/locations/europe-west4/publishers/google",
        timeout: 10000,
        headers: {
          "x-api-key": "secondary-api-key",
          "Content-Type": "application/json",
        },
      },
    });
  });

  it("omits httpOptions when no custom request options are provided", async () => {
    const { GeminiApi } = await import("../apis/Gemini.js");

    new GeminiApi({
      provider: "gemini",
      apiKey: "primary-api-key",
    });

    expect(GoogleGenAIMock).toHaveBeenCalledWith({
      apiKey: "primary-api-key",
      httpOptions: undefined,
    });
  });
});
