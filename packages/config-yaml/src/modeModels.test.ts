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
