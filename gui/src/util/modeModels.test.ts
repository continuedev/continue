import { describe, expect, it } from "vitest";
import {
  getModeModelTitle,
  getModeReasoningEffort,
  REASONING_EFFORT_BUDGET_TOKENS,
  reasoningOptionsForEffort,
} from "./modeModels";

const config = {
  modeModels: {
    plan: { title: "Opus", reasoningEffort: "medium" as const },
    agent: { title: "Sonnet", reasoningEffort: "low" as const },
  },
};

describe("getModeModelTitle", () => {
  it("uses the configured model for a mode", () => {
    expect(getModeModelTitle(config, "plan")).toBe("Opus");
    expect(getModeModelTitle(config, "agent")).toBe("Sonnet");
  });

  it("keeps the current model (undefined) for modes without an entry", () => {
    expect(getModeModelTitle(config, "chat")).toBeUndefined();
    expect(getModeModelTitle({}, "plan")).toBeUndefined();
    expect(getModeModelTitle(config, "background")).toBeUndefined();
  });

  it("lets a manual per-mode pick win", () => {
    expect(getModeModelTitle(config, "plan", { plan: "Haiku" })).toBe("Haiku");
    expect(getModeModelTitle(config, "agent", { plan: "Haiku" })).toBe(
      "Sonnet",
    );
    expect(getModeModelTitle({}, "chat", { chat: "Haiku" })).toBe("Haiku");
  });
});

describe("reasoning effort", () => {
  it("reads the effort per mode", () => {
    expect(getModeReasoningEffort(config, "plan")).toBe("medium");
    expect(getModeReasoningEffort(config, "chat")).toBeUndefined();
  });

  it("maps effort to completion options", () => {
    expect(reasoningOptionsForEffort(undefined)).toBeUndefined();
    expect(reasoningOptionsForEffort("off")).toEqual({ reasoning: false });
    expect(reasoningOptionsForEffort("low")).toEqual({
      reasoning: true,
      reasoningBudgetTokens: REASONING_EFFORT_BUDGET_TOKENS.low,
    });
    expect(
      reasoningOptionsForEffort("high")!.reasoningBudgetTokens,
    ).toBeGreaterThan(
      reasoningOptionsForEffort("medium")!.reasoningBudgetTokens!,
    );
  });
});
