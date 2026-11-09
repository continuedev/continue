import { describe, expect, it } from "vitest";
import {
  modeModelFor,
  reasoningOptionsForEffort,
  useForLoopTurn,
} from "./modelUse";

const modeModels = {
  plan: { title: "Opus", reasoningEffort: "high" as const },
  agent: { title: "Sonnet" },
  loop: { title: "Haiku", reasoningEffort: "off" as const },
};

describe("modeModelFor", () => {
  it("returns a use's own entry", () => {
    expect(modeModelFor(modeModels, "loop")).toEqual({
      title: "Haiku",
      reasoningEffort: "off",
    });
    expect(modeModelFor(modeModels, "plan")?.title).toBe("Opus");
  });

  it("falls back: a re-plan to the plan entry, an item to the agent entry", () => {
    expect(modeModelFor(modeModels, "replan")).toEqual({
      title: "Opus",
      reasoningEffort: "high",
    });
    expect(modeModelFor({ agent: { title: "Sonnet" } }, "loop")?.title).toBe(
      "Sonnet",
    );
  });

  it("has no fallback for chat, the reviewer or subagents", () => {
    expect(modeModelFor(modeModels, "chat")).toBeUndefined();
    expect(modeModelFor(modeModels, "reviewer")).toBeUndefined();
    expect(modeModelFor(modeModels, "subagent")).toBeUndefined();
    expect(modeModelFor(undefined, "loop")).toBeUndefined();
  });
});

it("a Loop item acts and everything else re-plans", () => {
  expect(useForLoopTurn("item")).toBe("loop");
  expect(useForLoopTurn("replan")).toBe("replan");
  expect(useForLoopTurn("check")).toBe("replan");
});

it("maps an effort to a thinking budget, off to no reasoning, none to nothing", () => {
  expect(reasoningOptionsForEffort("medium")).toEqual({
    reasoning: true,
    reasoningBudgetTokens: 4096,
  });
  expect(reasoningOptionsForEffort("off")).toEqual({ reasoning: false });
  expect(reasoningOptionsForEffort(undefined)).toBeUndefined();
});
