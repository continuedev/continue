import { describe, expect, it, vi } from "vitest";
import AceDataCloud from "./AceDataCloud.js";

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
    const llm = new AceDataCloud({ model: "gpt-5.5", useResponsesApi: true });
    expect(llm["openaiAdapter"]?.responsesStream).toBeUndefined();
    expect(llm["openaiAdapter"]?.chatCompletionStream).toBeTypeOf("function");
  });
});
