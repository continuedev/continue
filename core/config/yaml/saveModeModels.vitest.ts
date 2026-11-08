import { describe, expect, it } from "vitest";
import * as YAML from "yaml";
import { editYamlText } from "../../util/yamlEdit";
import { applyModeModelsUpdate } from "./saveModeModels";

const apply = (
  source: string,
  update: Parameters<typeof applyModeModelsUpdate>[1],
) => editYamlText<any>(source, (c) => applyModeModelsUpdate(c, update));

const BASE = `# my config
name: Local
version: 1.0.0
schema: v1

models:
  # primary
  - name: Opus
    provider: anthropic
    model: claude-opus
  - name: Sonnet
    provider: anthropic
    model: claude-sonnet
`;

describe("applyModeModelsUpdate", () => {
  it("adds a modeModels block and keeps comments elsewhere", () => {
    const { text } = apply(BASE, {
      plan: {
        model: "Opus",
        models: ["Opus", "Sonnet"],
        reasoningEffort: "high",
      },
    });
    expect(text).toContain("# my config");
    expect(text).toContain("# primary");
    expect(YAML.parse(text!).modeModels).toEqual({
      plan: {
        model: "Opus",
        models: ["Opus", "Sonnet"],
        reasoningEffort: "high",
      },
    });
  });

  it("leaves modes it does not mention exactly as they are", () => {
    const src = `${BASE}
modeModels:
  agent:
    model: Sonnet # fast
    reasoningEffort: low
`;
    const { text } = apply(src, { plan: { model: "Opus" } });
    const parsed = YAML.parse(text!);
    expect(parsed.modeModels.agent).toEqual({
      model: "Sonnet",
      reasoningEffort: "low",
    });
    expect(parsed.modeModels.plan).toEqual({ model: "Opus" });
    expect(text).toContain("# fast");
  });

  it("keeps fields it was not asked to change", () => {
    const src = `${BASE}
modeModels:
  plan:
    model: Opus
    reasoningEffort: medium
`;
    const { text } = apply(src, { plan: { models: ["Opus", "Sonnet"] } });
    expect(YAML.parse(text!).modeModels.plan).toEqual({
      model: "Opus",
      models: ["Opus", "Sonnet"],
      reasoningEffort: "medium",
    });
  });

  it("removes a mode with null, and the whole block when it is the last", () => {
    const src = `${BASE}
modeModels:
  plan:
    model: Opus
  agent:
    model: Sonnet
`;
    const one = apply(src, { plan: null });
    expect(YAML.parse(one.text!).modeModels).toEqual({
      agent: { model: "Sonnet" },
    });
    const both = apply(one.text!, { agent: null });
    expect(YAML.parse(both.text!)).not.toHaveProperty("modeModels");
  });

  it("removes the list with [] and falls back to the default model", () => {
    const src = `${BASE}
modeModels:
  plan:
    model: Opus
    models: [Opus, Sonnet]
`;
    const { text } = apply(src, { plan: { models: [] } });
    expect(YAML.parse(text!).modeModels.plan).toEqual({ model: "Opus" });
  });

  it("drops an entry that would have neither a model nor a list", () => {
    const src = `${BASE}
modeModels:
  plan:
    models: [Opus]
`;
    const { text } = apply(src, { plan: { models: [] } });
    expect(YAML.parse(text!)).not.toHaveProperty("modeModels");
  });

  it("clears reasoning effort with null", () => {
    const src = `${BASE}
modeModels:
  plan:
    model: Opus
    reasoningEffort: high
`;
    const { text } = apply(src, { plan: { reasoningEffort: null } });
    expect(YAML.parse(text!).modeModels.plan).toEqual({ model: "Opus" });
  });

  it("removes duplicate and empty names from the list", () => {
    const { text } = apply(BASE, {
      plan: { models: ["Opus", "Opus", "", "Sonnet", "Opus"] },
    });
    expect(YAML.parse(text!).modeModels.plan.models).toEqual([
      "Opus",
      "Sonnet",
    ]);
  });

  it("reports no change when the update matches what is there", () => {
    const src = `${BASE}
modeModels:
  plan:
    model: Opus
    models: [Opus, Sonnet]
`;
    expect(
      apply(src, { plan: { model: "Opus", models: ["Opus", "Sonnet"] } }).text,
    ).toBeUndefined();
  });

  it("an empty update changes nothing", () => {
    expect(apply(BASE, {}).text).toBeUndefined();
  });

  it("keeps a per-entry comment when a model is removed from the list", () => {
    const src = `${BASE}
modeModels:
  plan:
    models:
      # best
      - Opus
      # cheap
      - Sonnet
`;
    const { text } = apply(src, { plan: { models: ["Sonnet"] } });
    expect(YAML.parse(text!).modeModels.plan.models).toEqual(["Sonnet"]);
    expect(text).toMatch(/# cheap\s+- Sonnet/);
  });
});

describe("applyModeModelsUpdate: single-model uses", () => {
  it("writes one model for loop, replan and subagent, never a list", () => {
    const { text } = apply(BASE, {
      loop: { model: "Sonnet", models: ["Sonnet", "Opus"] },
      replan: { model: "Opus", reasoningEffort: "high" },
      subagent: { model: "Sonnet" },
    });
    const parsed = YAML.parse(text ?? "");
    expect(parsed.modeModels).toEqual({
      loop: { model: "Sonnet" },
      replan: { model: "Opus", reasoningEffort: "high" },
      subagent: { model: "Sonnet" },
    });
  });

  it("removes a single-model use set to null and leaves the modes alone", () => {
    const start = apply(BASE, {
      plan: { model: "Opus" },
      loop: { model: "Sonnet" },
    }).text;
    const { text } = apply(start ?? "", { loop: null });
    expect(YAML.parse(text ?? "").modeModels).toEqual({
      plan: { model: "Opus" },
    });
  });
});
