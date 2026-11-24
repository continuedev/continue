import { describe, expect, it, vi } from "vitest";
import AceDataCloud from "./AceDataCloud.js";
import { DEFAULT_MAX_TOKENS } from "../constants.js";

vi.mock("../../data/devdataSqlite.js", () => ({ DevDataSqliteDb: {} }));
vi.mock("../../data/log.js", () => ({ DataLogger: {} }));

describe("AceDataCloud", () => {
  it("registers a named provider without translating the selected model", () => {
    const llm = new AceDataCloud({ model: "gpt-5.5", apiKey: "test-key" });
    expect(AceDataCloud.providerName).toBe("acedatacloud");
    expect(llm.model).toBe("gpt-5.5");
    expect(llm.apiBase).toBe("https://api.acedata.cloud/v1/");
    expect(llm["openaiAdapter"]?.responsesStream).toBeUndefined();
  });

  it("uses Chat Completions even if inherited settings request Responses", () => {
    const llm = new AceDataCloud({
      model: "gpt-5.5",
      useResponsesApi: true,
      useLegacyCompletionsEndpoint: true,
    });
    expect(llm["openaiAdapter"]?.responsesStream).toBeUndefined();
    expect(llm["openaiAdapter"]?.chatCompletionStream).toBeTypeOf("function");
    expect(llm.useLegacyCompletionsEndpoint).toBe(false);
  });

  it("keeps unknown Ace capacities and capabilities separate from vendor-name guesses", () => {
    const unknown = new AceDataCloud({ model: "gpt-4o" });
    expect(unknown._contextLength).toBeUndefined();
    expect(unknown.completionOptions.maxTokens).toBe(DEFAULT_MAX_TOKENS);
    expect(unknown.supportsImages()).toBe(false);
    const configured = new AceDataCloud({
      model: "gpt-4o",
      contextLength: 12000,
      completionOptions: { model: "gpt-4o", maxTokens: 512 },
      capabilities: { uploadImage: true },
    });
    expect(configured._contextLength).toBe(12000);
    expect(configured.completionOptions.maxTokens).toBe(512);
    expect(configured.supportsImages()).toBe(true);
  });
});
