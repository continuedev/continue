import { configYamlSchema, modeModelsSchema } from "./schemas/index.js";

describe("modeModels schema", () => {
  it("accepts a model per mode with optional reasoning effort", () => {
    const parsed = modeModelsSchema.parse({
      plan: { model: "Opus", reasoningEffort: "medium" },
      agent: { model: "Sonnet", reasoningEffort: "low" },
      chat: { model: "Haiku" },
    });
    expect(parsed.plan?.reasoningEffort).toBe("medium");
    expect(parsed.chat?.reasoningEffort).toBeUndefined();
  });

  it("rejects unknown effort values", () => {
    expect(() =>
      modeModelsSchema.parse({ plan: { model: "x", reasoningEffort: "max" } }),
    ).toThrow();
  });

  it("accepts a list of models, with or without a default", () => {
    const parsed = modeModelsSchema.parse({
      plan: { model: "Opus", models: ["Opus", "GPT"] },
      agent: { models: ["Sonnet"] },
    });
    expect(parsed.plan?.models).toEqual(["Opus", "GPT"]);
    expect(parsed.agent?.model).toBeUndefined();
    expect(parsed.agent?.models).toEqual(["Sonnet"]);
  });

  it("rejects an entry with neither a model nor a non-empty list", () => {
    expect(() => modeModelsSchema.parse({ plan: {} })).toThrow();
    expect(() => modeModelsSchema.parse({ plan: { models: [] } })).toThrow();
    expect(() =>
      modeModelsSchema.parse({ plan: { reasoningEffort: "low" } }),
    ).toThrow();
  });

  it("rejects a non-string in the list", () => {
    expect(() =>
      modeModelsSchema.parse({ plan: { models: ["ok", 3] } }),
    ).toThrow();
  });

  it("is part of config.yaml", () => {
    const cfg = configYamlSchema.parse({
      name: "c",
      version: "1",
      models: [{ name: "Opus", provider: "anthropic", model: "claude-opus" }],
      modeModels: { plan: { model: "Opus" } },
    });
    expect(cfg.modeModels?.plan?.model).toBe("Opus");
  });
});

import { Registry } from "./interfaces/index.js";
import { mergeUnrolledAssistants } from "./load/merge.js";
import { unrollBlocks } from "./load/unroll.js";

const emptyRegistry: Registry = {
  getContent: async () => {
    throw new Error("no blocks expected");
  },
};

describe("modeModels through unrolling", () => {
  it("is preserved when unrolling an assistant", async () => {
    const result = await unrollBlocks(
      {
        name: "c",
        version: "1",
        modeModels: {
          plan: { model: "Opus", reasoningEffort: "high" },
        },
      },
      emptyRegistry,
      undefined,
    );
    expect(result.config?.modeModels?.plan).toEqual({
      model: "Opus",
      reasoningEffort: "high",
    });
  });

  it("merges per mode, with incoming winning", () => {
    const merged = mergeUnrolledAssistants(
      {
        name: "a",
        version: "1",
        modeModels: { plan: { model: "A" }, chat: { model: "C" } },
      },
      { name: "b", version: "1", modeModels: { plan: { model: "B" } } },
    );
    expect(merged.modeModels).toEqual({
      plan: { model: "B" },
      chat: { model: "C" },
    });
  });
});

describe("modeModels: the uses beyond the modes", () => {
  it("accepts one model each for loop, replan, reviewer and subagent", () => {
    const parsed = modeModelsSchema.parse({
      loop: { model: "Haiku", reasoningEffort: "off" },
      replan: { model: "Opus" },
      reviewer: { model: "Judge", reasoningEffort: "low" },
      subagent: { model: "Sonnet" },
    });
    expect(parsed.loop).toEqual({ model: "Haiku", reasoningEffort: "off" });
    expect(parsed.reviewer?.reasoningEffort).toBe("low");
  });

  it("needs a model there: a list alone is not enough", () => {
    expect(() =>
      modeModelsSchema.parse({ loop: { models: ["Haiku"] } }),
    ).toThrow();
    expect(() => modeModelsSchema.parse({ reviewer: { model: "" } })).toThrow();
  });

  it("is part of config.yaml with the modes", () => {
    const cfg = configYamlSchema.parse({
      name: "c",
      version: "1",
      models: [{ name: "Opus", provider: "anthropic", model: "claude-opus" }],
      modeModels: { plan: { model: "Opus" }, replan: { model: "Opus" } },
    });
    expect(cfg.modeModels?.replan?.model).toBe("Opus");
  });
});
