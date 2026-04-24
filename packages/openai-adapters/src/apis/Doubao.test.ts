import { describe, expect, it } from "vitest";
import { constructLlmApi } from "../index.js";
import { DoubaoApi } from "./Doubao.js";

describe("Doubao (ByteDance / Volcengine Ark) adapter", () => {
  it("registers under the 'doubao' provider and returns a DoubaoApi", () => {
    const api = constructLlmApi({
      provider: "doubao",
      apiKey: "test-key",
    });
    expect(api).toBeInstanceOf(DoubaoApi);
  });

  it("points at the Ark cn-beijing base URL by default", () => {
    const api = new DoubaoApi({
      provider: "doubao",
      apiKey: "test-key",
    });
    // apiBase is a public field on the adapter; sanity-check it directly so
    // a future refactor can't silently swap the default to, say, api.openai.com.
    expect(api.apiBase).toBe("https://ark.cn-beijing.volces.com/api/v3/");
  });

  it("inherits from OpenAIApi (OpenAI-compatible Ark /chat/completions)", () => {
    const api = new DoubaoApi({
      provider: "doubao",
      apiKey: "test-key",
    });
    // Ark is OpenAI-compatible for /chat/completions; the adapter relies on
    // the base class, so it must not accidentally drop that relationship.
    expect(typeof api.chatCompletionStream).toBe("function");
    expect(typeof api.chatCompletionNonStream).toBe("function");
  });
});
