import { createLoop, startItemRun } from "core/util/loopMode";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it, vi } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import { RootState } from "../store";
import { applyLoopHolds } from "./loopHolds";

const NOW = new Date("2026-11-08T10:00:00Z");
const PLAN = {
  items: [{ id: "1", text: "Fix it", status: "pending" as const }],
  updatedAt: NOW.toISOString(),
};

function evaluate(autonomy: "supervised" | "auto") {
  const state = getEmptyRootState();
  const loop = {
    ...startItemRun(
      createLoop(PLAN, { now: NOW, sessionTokens: 0 }),
      "1",
      0,
      NOW,
    ),
    autonomy,
  };
  let current: RootState = {
    ...state,
    session: { ...state.session, loop, history: [] },
  };
  const dispatch = vi.fn((action: any) => {
    if (action.type === "session/setLoop") {
      current = {
        ...current,
        session: { ...current.session, loop: action.payload },
      };
    }
    return action;
  });
  const [result] = applyLoopHolds(dispatch as any, () => current, [
    {
      policy: "allowedWithoutPermission",
      toolCallState: {
        toolCallId: "call",
        toolCall: {
          id: "call",
          type: "function",
          function: {
            name: BuiltInToolNames.SingleFindAndReplace,
            arguments: "{}",
          },
        },
        parsedArgs: { filepath: "a.ts" },
        status: "generated",
      } as any,
    },
  ]);
  return { result, dispatch };
}

describe("a file edit during a loop's item", () => {
  it("asks first when the level keeps the person in charge", () => {
    const { result } = evaluate("supervised");
    expect(result.policy).toBe("disabled");
  });

  it("just runs at the levels that go on alone", () => {
    const { result } = evaluate("auto");
    expect(result.policy).toBe("allowedWithoutPermission");
  });
});
