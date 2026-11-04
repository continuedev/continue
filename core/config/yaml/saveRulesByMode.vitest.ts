import { describe, expect, it } from "vitest";
import * as YAML from "yaml";
import { rulesEnabledForMode } from "../../llm/rules/rulesByMode";
import { editYamlText } from "../../util/yamlEdit";
import { applyRulesByModeUpdate } from "./saveRulesByMode";

const apply = (
  source: string,
  update: Parameters<typeof applyRulesByModeUpdate>[1],
) => editYamlText<any>(source, (c) => applyRulesByModeUpdate(c, update));

const BASE = `# my config
name: Local
version: 1.0.0
schema: v1

rules:
  # keep it short
  - Be brief
`;

describe("applyRulesByModeUpdate", () => {
  it("adds the block and keeps comments", () => {
    const { text } = apply(BASE, { chat: false, plan: false });
    expect(text).toContain("# my config");
    expect(text).toContain("# keep it short");
    expect(YAML.parse(text!).rulesByMode).toEqual({
      chat: false,
      plan: false,
    });
  });

  it("leaves other modes alone and removes an entry on null", () => {
    const first = apply(BASE, { chat: false, agent: false }).text!;
    const { text } = apply(first, { chat: null });
    expect(YAML.parse(text!).rulesByMode).toEqual({ agent: false });
    expect(text).toContain("# keep it short");
  });

  it("drops the key when nothing is left", () => {
    const first = apply(BASE, { plan: false }).text!;
    const { text } = apply(first, { plan: null });
    expect(YAML.parse(text!).rulesByMode).toBeUndefined();
  });
});

describe("rulesEnabledForMode", () => {
  it("is on unless the mode is false", () => {
    expect(rulesEnabledForMode(undefined, "chat")).toBe(true);
    expect(rulesEnabledForMode({}, "agent")).toBe(true);
    expect(rulesEnabledForMode({ chat: false }, "chat")).toBe(false);
    expect(rulesEnabledForMode({ chat: false }, "plan")).toBe(true);
  });

  it("background follows agent", () => {
    expect(rulesEnabledForMode({ agent: false }, "background")).toBe(false);
    expect(rulesEnabledForMode({ chat: false }, "background")).toBe(true);
  });
});
