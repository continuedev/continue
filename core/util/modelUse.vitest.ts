import { describe, expect, it } from "vitest";
import {
  modeModelFor,
  modelForLoopItem,
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

describe("modelForLoopItem", () => {
  const model = (title: string, id: string, provider = "bedrock") => ({
    title,
    model: id,
    provider,
  });
  const opus = model("Claude Opus", "us.anthropic.claude-opus-4-8");
  const nova = model("Nova Lite", "us.amazon.nova-2-lite-v1:0");
  const haiku = model("Haiku direct", "claude-haiku-4-5", "anthropic");
  const chat = [opus, nova, haiku];

  it("an item without a model takes the loop model and records nothing", () => {
    expect(modelForLoopItem({ text: "a" } as any, chat, nova)).toEqual({
      model: nova,
    });
    expect(modelForLoopItem(undefined, chat, undefined)).toEqual({
      model: undefined,
    });
  });

  it("an item's own model wins, by name, id or family alias", () => {
    expect(modelForLoopItem({ model: "claude opus" }, chat, nova)).toEqual({
      model: opus,
      record: { title: "Claude Opus" },
    });
    expect(
      modelForLoopItem({ model: "claude-haiku-4-5" }, chat, nova).model,
    ).toBe(haiku);
    expect(modelForLoopItem({ model: "opus" }, chat, nova).model).toBe(opus);
  });

  it("a model that is not configured falls back to the loop model with the reason", () => {
    expect(modelForLoopItem({ model: "gpt-9" }, chat, nova)).toEqual({
      model: nova,
      record: {
        title: "Nova Lite",
        fallbackReason: 'model "gpt-9" is not configured; using Nova Lite',
      },
    });
    // No loop model either: whichever model is selected stays
    expect(modelForLoopItem({ model: "gpt-9" }, chat, undefined)).toEqual({
      model: undefined,
      record: {
        title: "the selected model",
        fallbackReason:
          'model "gpt-9" is not configured; using the selected model',
      },
    });
  });
});

it("maps an effort to a thinking budget, off to no reasoning, none to nothing", () => {
  expect(reasoningOptionsForEffort("medium")).toEqual({
    reasoning: true,
    reasoningBudgetTokens: 4096,
  });
  expect(reasoningOptionsForEffort("off")).toEqual({ reasoning: false });
  expect(reasoningOptionsForEffort(undefined)).toBeUndefined();
});
