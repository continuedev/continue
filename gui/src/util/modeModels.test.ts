import { describe, expect, it } from "vitest";
import {
  getModeModelTitle,
  getModeModelTitles,
  getModeReasoningEffort,
  nextModelTitle,
  partitionModelsByMode,
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

describe("getModeModelTitles", () => {
  const withLists = {
    modeModels: {
      plan: { title: "Opus", titles: ["Opus", "Sonnet"] },
      agent: { title: "Sonnet" },
    },
  };

  it("returns the offered list for a mode that has one", () => {
    expect(getModeModelTitles(withLists, "plan")).toEqual(["Opus", "Sonnet"]);
  });

  it("is undefined without a list, so every model is offered", () => {
    expect(getModeModelTitles(withLists, "agent")).toBeUndefined();
    expect(getModeModelTitles(withLists, "chat")).toBeUndefined();
    expect(getModeModelTitles({}, "plan")).toBeUndefined();
    expect(getModeModelTitles(withLists, "background")).toBeUndefined();
  });

  it("treats an empty list as no list", () => {
    expect(
      getModeModelTitles(
        { modeModels: { plan: { title: "A", titles: [] } } },
        "plan",
      ),
    ).toBeUndefined();
  });
});

describe("partitionModelsByMode", () => {
  const options = ["A", "B", "C", "D"].map((value) => ({ value }));

  it("puts offered models first in configured order and keeps the rest in order", () => {
    const { offered, rest } = partitionModelsByMode(options, ["C", "A"]);
    expect(offered.map((o) => o.value)).toEqual(["C", "A"]);
    expect(rest.map((o) => o.value)).toEqual(["B", "D"]);
  });

  it("skips titles that match no option and ignores duplicates", () => {
    const { offered, rest } = partitionModelsByMode(options, ["Z", "B", "B"]);
    expect(offered.map((o) => o.value)).toEqual(["B"]);
    expect(rest.map((o) => o.value)).toEqual(["A", "C", "D"]);
  });

  it("offers nothing when there is no list", () => {
    const { offered, rest } = partitionModelsByMode(options, undefined);
    expect(offered).toEqual([]);
    expect(rest).toBe(options);
  });
});

describe("nextModelTitle", () => {
  const c = ["A", "B", "C"].map((value) => ({ value }));

  it("moves forward and wraps", () => {
    expect(nextModelTitle(c, "A")).toBe("B");
    expect(nextModelTitle(c, "C")).toBe("A");
  });

  it("moves back and wraps", () => {
    expect(nextModelTitle(c, "B", -1)).toBe("A");
    expect(nextModelTitle(c, "A", -1)).toBe("C");
  });

  it("starts at the first (or last, going back) when the current model is not offered", () => {
    expect(nextModelTitle(c, "Z")).toBe("A");
    expect(nextModelTitle(c, undefined)).toBe("A");
    expect(nextModelTitle(c, "Z", -1)).toBe("C");
  });

  it("stays put with a single candidate", () => {
    expect(nextModelTitle([{ value: "A" }], "A")).toBe("A");
  });

  it("returns undefined for no candidates instead of throwing", () => {
    expect(nextModelTitle([], "A")).toBeUndefined();
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
