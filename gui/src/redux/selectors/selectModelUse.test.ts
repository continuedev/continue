import { createLoop, startItemRun, startReplan } from "core/util/loopMode";
import { describe, expect, it } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import { selectModelUse } from "./selectModelUse";

const T0 = new Date("2026-11-08T10:00:00Z");
const plan = {
  items: [{ id: "1", text: "Write the lexer", status: "pending" as const }],
  updatedAt: T0.toISOString(),
};
const loop = () => createLoop(plan, { now: T0, sessionTokens: 0 });

describe("selectModelUse", () => {
  it("is the mode when no loop runs", () => {
    const state = getEmptyRootState();
    state.session.mode = "plan";
    expect(selectModelUse(state)).toBe("plan");
    state.session.mode = "background";
    expect(selectModelUse(state)).toBeUndefined();
  });

  it("is loop while an item runs and replan while a re-plan runs", () => {
    const state = getEmptyRootState();
    state.session.mode = "agent";
    state.session.loop = startItemRun(loop(), "1", 0, T0);
    expect(selectModelUse(state)).toBe("loop");
    state.session.mode = "plan";
    state.session.loop = startReplan(loop(), 0, T0, { plan });
    expect(selectModelUse(state)).toBe("replan");
  });

  it("is the mode again once the loop has stopped or has nothing running", () => {
    const state = getEmptyRootState();
    state.session.mode = "agent";
    state.session.loop = loop();
    expect(selectModelUse(state)).toBe("agent");
    state.session.loop = {
      ...startItemRun(loop(), "1", 0, T0),
      status: "stopped",
    };
    expect(selectModelUse(state)).toBe("agent");
  });
});
