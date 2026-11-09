import { describe, expect, it } from "vitest";

import {
  actTurn,
  actTurnFor,
  actTurnShort,
  CLI_TURN_TOOL_NAMES,
  IDE_TURN_TOOL_NAMES,
  planTurn,
  planTurnFor,
  planTurnShort,
  promptProfile,
} from "./turns";

describe("prompt profile", () => {
  it("is short for Qwen and full for everything else or unknown", () => {
    expect(promptProfile("qwen.qwen3-coder-30b-a3b-v1:0")).toBe("short");
    expect(promptProfile("qwen3.8-flash-next-nvfp4-nvfp4")).toBe("short");
    expect(promptProfile("us.anthropic.claude-haiku-4-5-20251001-v1:0")).toBe(
      "full",
    );
    expect(promptProfile("us.amazon.nova-2-lite-v1:0")).toBe("full");
    expect(promptProfile(undefined)).toBe("full");
  });

  it("selects the matching turn text", () => {
    expect(actTurnFor("qwen.qwen3-32b-v1:0", CLI_TURN_TOOL_NAMES)).toBe(
      actTurnShort(CLI_TURN_TOOL_NAMES),
    );
    expect(planTurnFor("qwen.qwen3-32b-v1:0")).toBe(
      planTurnShort(IDE_TURN_TOOL_NAMES),
    );
    expect(actTurnFor("gpt-5")).toBe(actTurn());
    expect(planTurnFor("gpt-5")).toBe(planTurn());
  });
});

describe("short turns", () => {
  it("are a third of the words and name the tools", () => {
    const words = (text: string) => text.split(/\s+/).length;
    expect(words(actTurnShort())).toBeLessThan(words(actTurn()) / 2);
    expect(words(planTurnShort())).toBeLessThan(words(planTurn()) / 2);
    expect(actTurnShort(CLI_TURN_TOOL_NAMES)).toContain("TaskList");
    expect(planTurnShort(CLI_TURN_TOOL_NAMES)).toContain("PresentPlan");
  });

  it("state the finish rule first and last", () => {
    const act = actTurnShort();
    expect(act.split("\n")[0]).toContain(
      "Your turn lasts until the request is done",
    );
    expect(act.trim().split("\n").at(-1)).toContain(
      "Keep going until the request is done",
    );
    const plan = planTurnShort(CLI_TURN_TOOL_NAMES);
    expect(plan).toContain("End by calling PresentPlan, then stop");
    expect(plan.trim().split("\n").at(-1)).toContain(
      "Your turn ends only by calling PresentPlan or by asking a question",
    );
  });

  it("close the command route and forbid a task list while planning", () => {
    expect(actTurnShort()).toContain(
      "do not reach the same result through a command",
    );
    expect(actTurnShort()).toContain("Call only the tools listed");
    expect(planTurnShort()).toContain("do not make a task list");
    expect(planTurnShort()).toMatch(/kept for themselves.*goes in `decisions`/);
  });
});
