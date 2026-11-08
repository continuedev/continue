import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { describe, expect, it, vi } from "vitest";

import {
  AUTO_COMPACT_BUFFER_CAP,
  getAutoCompactThreshold,
  shouldAutoCompact,
} from "./compaction.js";
import { getRequestBodyHints, getSubagentModel } from "./contextManagement.js";
import { processStreamingResponse } from "./stream/streamChatResponse.js";

vi.mock("gpt-tokenizer", () => ({
  encode: (text: string) => new Array(Math.ceil(text.length / 4)), // Rough 4 chars per token
}));

const createModel = (
  contextLength: number,
  maxTokens: number,
  contextManagement?: ModelConfig["contextManagement"],
): ModelConfig => ({
  name: "test-model",
  model: "test",
  provider: "openai",
  defaultCompletionOptions: { contextLength, maxTokens },
  contextManagement,
});

describe("getAutoCompactThreshold", () => {
  it("keeps today's buffer when nothing is configured", () => {
    // 1000 context, 200 output: buffer = max(200, ceil(0.2 * 800)) = 200
    expect(getAutoCompactThreshold(createModel(1000, 200))).toBe(600);
    // Large windows hit the buffer cap: 512K - 64K - 15K
    expect(getAutoCompactThreshold(createModel(524_288, 65_536))).toBe(
      524_288 - 65_536 - AUTO_COMPACT_BUFFER_CAP,
    );
  });

  it("uses autoCompactRatio as a plain fraction of the input space", () => {
    const model = createModel(524_288, 65_536, { autoCompactRatio: 0.5 });
    expect(getAutoCompactThreshold(model)).toBe(
      Math.floor(0.5 * (524_288 - 65_536)),
    );
  });

  it("caps the threshold at autoCompactTokens", () => {
    expect(
      getAutoCompactThreshold(
        createModel(524_288, 65_536, { autoCompactTokens: 120_000 }),
      ),
    ).toBe(120_000);
    // A cap above the default threshold changes nothing
    expect(
      getAutoCompactThreshold(
        createModel(1000, 200, { autoCompactTokens: 900 }),
      ),
    ).toBe(600);
  });

  it("takes the lower of ratio and token cap", () => {
    const model = createModel(1000, 200, {
      autoCompactRatio: 0.5,
      autoCompactTokens: 350,
    });
    expect(getAutoCompactThreshold(model)).toBe(350);
    model.contextManagement!.autoCompactTokens = 450;
    expect(getAutoCompactThreshold(model)).toBe(400);
  });

  it("throws when maxTokens leaves no input space", () => {
    expect(() =>
      getAutoCompactThreshold(
        createModel(1000, 1000, { autoCompactRatio: 0.5 }),
      ),
    ).toThrow("max_tokens is larger than context_length");
  });

  it("drives shouldAutoCompact", () => {
    const model = createModel(1000, 200, { autoCompactRatio: 0.25 });
    const history = (tokens: number) => [
      {
        message: { role: "user" as const, content: "x".repeat(tokens * 4) },
        contextItems: [],
      },
    ];
    // Threshold 200: compacts well before the default threshold of 600
    expect(shouldAutoCompact({ chatHistory: history(150), model })).toBe(false);
    expect(shouldAutoCompact({ chatHistory: history(250), model })).toBe(true);
  });
});

describe("shouldAutoCompact with a budget below the fixed prompt", () => {
  const systemMessage = "s".repeat(400 * 4); // 400 tokens
  const history = (tokens: number) => [
    {
      message: { role: "user" as const, content: "x".repeat(tokens * 4) },
      contextItems: [],
    },
  ];

  it("does not compact while the input still fits", () => {
    const model = createModel(2000, 200, { autoCompactTokens: 300 });
    expect(
      shouldAutoCompact({ chatHistory: history(100), model, systemMessage }),
    ).toBe(false);
  });

  it("compacts once the input no longer fits", () => {
    const model = createModel(2000, 200, { autoCompactTokens: 300 });
    expect(
      shouldAutoCompact({ chatHistory: history(1500), model, systemMessage }),
    ).toBe(true);
  });

  it("still compacts normally when the fixed prompt is below the threshold", () => {
    const model = createModel(2000, 200, { autoCompactTokens: 600 });
    expect(
      shouldAutoCompact({ chatHistory: history(300), model, systemMessage }),
    ).toBe(true);
  });
});

describe("getSubagentModel", () => {
  it("returns the model unchanged without a sub-agent budget", () => {
    const model = createModel(524_288, 65_536, { autoCompactRatio: 0.5 });
    expect(getSubagentModel(model)).toBe(model);
  });

  it("lowers the context limit and compacts within it", () => {
    const model = createModel(524_288, 16_384, {
      subagent: { contextLength: 65_536, autoCompactRatio: 0.75 },
    });
    const subModel = getSubagentModel(model);

    expect(subModel.defaultCompletionOptions?.contextLength).toBe(65_536);
    expect(subModel.defaultCompletionOptions?.maxTokens).toBe(16_384);
    expect(getAutoCompactThreshold(subModel)).toBe(
      Math.floor(0.75 * (65_536 - 16_384)),
    );
    // The parent model is not modified
    expect(model.defaultCompletionOptions?.contextLength).toBe(524_288);
  });

  it("never raises the context limit above the model's", () => {
    const model = createModel(32_768, 4096, {
      subagent: { contextLength: 65_536 },
    });
    expect(
      getSubagentModel(model).defaultCompletionOptions?.contextLength,
    ).toBe(32_768);
  });

  it("inherits the model's auto-compaction settings unless overridden", () => {
    const model = createModel(524_288, 16_384, {
      autoCompactRatio: 0.5,
      autoCompactTokens: 200_000,
      subagent: { contextLength: 65_536 },
    });
    const subModel = getSubagentModel(model);
    expect(subModel.contextManagement?.autoCompactRatio).toBe(0.5);
    expect(getAutoCompactThreshold(subModel)).toBe(
      Math.floor(0.5 * (65_536 - 16_384)),
    );

    model.contextManagement!.subagent!.autoCompactTokens = 20_000;
    expect(getAutoCompactThreshold(getSubagentModel(model))).toBe(20_000);
  });
});

describe("request body hints", () => {
  const strataHints = {
    requestBodyHints: {
      oneShot: { strata_checkpoint: false },
      conversation: { strata_prefix: { messages: 1 } },
    },
  };

  it("are empty unless configured", () => {
    const model = createModel(1000, 200);
    expect(getRequestBodyHints(model, "oneShot")).toEqual({});
    expect(getRequestBodyHints(model, "conversation")).toEqual({});
  });

  it("are chosen by request kind", () => {
    const model = createModel(1000, 200, strataHints);
    expect(getRequestBodyHints(model, "oneShot")).toEqual({
      strata_checkpoint: false,
    });
    expect(getRequestBodyHints(model, "conversation")).toEqual({
      strata_prefix: { messages: 1 },
    });
  });

  async function sentBody(
    model: ModelConfig,
    isCompacting?: boolean,
  ): Promise<Record<string, unknown>> {
    const chatCompletionStream = vi.fn().mockImplementation(async function* () {
      yield {
        id: "test",
        object: "chat.completion.chunk",
        created: 0,
        model: "test",
        choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
      };
    });
    await processStreamingResponse({
      chatHistory: [
        { message: { role: "user", content: "hi" }, contextItems: [] },
      ],
      model,
      llmApi: { chatCompletionStream } as unknown as BaseLlmApi,
      abortController: new AbortController(),
      systemMessage: "You are a helpful assistant.",
      isCompacting,
    });
    return chatCompletionStream.mock.calls[0][0];
  }

  it("are added to the compaction request as one-shot", async () => {
    const body = await sentBody(createModel(10_000, 200, strataHints), true);
    expect(body.strata_checkpoint).toBe(false);
    expect(body).not.toHaveProperty("strata_prefix");
  });

  it("are added to conversation requests", async () => {
    const body = await sentBody(createModel(10_000, 200, strataHints));
    expect(body.strata_prefix).toEqual({ messages: 1 });
    expect(body).not.toHaveProperty("strata_checkpoint");
  });

  it("leave the body alone by default", async () => {
    const body = await sentBody(createModel(10_000, 200), true);
    expect(body).not.toHaveProperty("strata_checkpoint");
    expect(body).not.toHaveProperty("strata_prefix");
  });
});
