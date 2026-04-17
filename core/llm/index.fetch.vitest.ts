import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@continuedev/fetch", () => ({
  fetchwithRequestOptions: vi.fn(),
}));

vi.mock("../util/withExponentialBackoff.js", () => ({
  withExponentialBackoff: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("../util/ollamaHelper.js", () => ({
  isOllamaInstalled: vi.fn(async () => true),
}));

vi.mock("../util/lemonadeHelper.js", () => ({
  isLemonadeInstalled: vi.fn(async () => true),
}));

import { fetchwithRequestOptions } from "@continuedev/fetch";
import { LLMOptions } from "../index.js";
import { BaseLLM } from "./index.js";

class DummyLMStudioLLM extends BaseLLM {
  static providerName = "lmstudio";
  static defaultOptions: Partial<LLMOptions> = {
    model: "dummy-model",
    apiBase: "http://127.0.0.1:1234/v1/",
  };
}

describe("BaseLLM.fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a friendly LM Studio message for 127.0.0.1 refusals", async () => {
    vi.mocked(fetchwithRequestOptions).mockRejectedValue({
      code: "ECONNREFUSED",
      message: "connect ECONNREFUSED http://127.0.0.1:1234/v1/chat/completions",
    });

    const llm = new DummyLMStudioLLM({ model: "dummy-model" });

    await expect(
      llm.fetch(new URL("http://127.0.0.1:1234/v1/chat/completions")),
    ).rejects.toThrow(
      "Unable to connect to local LM Studio instance at http://127.0.0.1:1234. LM Studio may not be running, or the configured apiBase may be incorrect.",
    );
  });

  it("shows a friendly LM Studio message for localhost refusals", async () => {
    vi.mocked(fetchwithRequestOptions).mockRejectedValue({
      code: "ECONNREFUSED",
      message: "connect ECONNREFUSED http://localhost:1234/v1/chat/completions",
    });

    const llm = new DummyLMStudioLLM({ model: "dummy-model" });

    await expect(
      llm.fetch(new URL("http://localhost:1234/v1/chat/completions")),
    ).rejects.toThrow(
      "Unable to connect to local LM Studio instance at http://localhost:1234. LM Studio may not be running, or the configured apiBase may be incorrect.",
    );
  });
});
