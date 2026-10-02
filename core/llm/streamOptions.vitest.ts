import { describe, expect, it, vi } from "vitest";

import { OpenAIApi } from "../../packages/openai-adapters/src/apis/OpenAI.js";
import { modelSchema } from "../../packages/config-yaml/src/schemas/models.js";
import { BaseLLM } from "./index.js";

vi.mock("../data/devdataSqlite.js", () => ({ DevDataSqliteDb: {} }));
vi.mock("../data/log.js", () => ({ DataLogger: {} }));
vi.mock("../util/Logger.js", () => ({ Logger: {} }));
vi.mock("./countTokens.js", () => ({
  compileChatMessages: vi.fn(),
  countTokens: vi.fn(),
  pruneRawPromptFromTop: vi.fn(),
}));

class TestOpenAI extends BaseLLM {
  static providerName = "openai";

  streamingBody() {
    return (this.openaiAdapter as OpenAIApi).modifyChatBody({
      model: this.model,
      messages: [{ role: "user", content: "hello" }],
      stream: true,
    });
  }
}

describe("streamOptions model configuration", () => {
  it("omits stream_options when disabled in the parsed model configuration", () => {
    const model = modelSchema.parse({
      name: "Strict endpoint",
      provider: "openai",
      model: "endpoint",
      apiKey: "test-key",
      streamOptions: false,
    });

    const llm = new TestOpenAI({
      model: model.model,
      apiKey: model.apiKey,
      streamOptions: model.streamOptions,
    });

    expect(llm.streamingBody()).not.toHaveProperty("stream_options");
  });

  it("includes streaming usage when the setting is omitted", () => {
    expect(
      new TestOpenAI({ model: "gpt-4", apiKey: "test-key" }).streamingBody(),
    ).toHaveProperty("stream_options.include_usage", true);
  });
});
