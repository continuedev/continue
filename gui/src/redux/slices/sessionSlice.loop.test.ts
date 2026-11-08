import type { Session } from "core";
import { createLoop, startItemRun } from "core/util/loopMode";
import { describe, expect, it } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import sessionReducer, { newSession } from "./sessionSlice";

/* Loop mode across a reload: the loop is saved with the session and comes back. */

const T0 = new Date("2026-11-07T10:00:00Z");
const taskPlan = {
  items: [
    { id: "1", text: "Write the lexer", status: "in_progress" as const },
    { id: "2", text: "Add tests", status: "pending" as const },
  ],
  updatedAt: T0.toISOString(),
};

function saved(loop: Session["loop"], extra: Partial<Session> = {}): Session {
  return {
    sessionId: "s1",
    title: "Loop",
    workspaceDirectory: "",
    history: [{ message: { role: "user", content: "go" }, contextItems: [] }],
    taskPlan,
    loop,
    ...extra,
  };
}

const empty = () => getEmptyRootState().session;

describe("Loop mode across a reload", () => {
  it("a loop saved between runs comes back as it was", () => {
    const loop = createLoop(taskPlan, { now: T0, sessionTokens: 10 });
    const state = sessionReducer(empty(), newSession(saved(loop)));
    expect(state.loop).toEqual(loop);
  });

  it("a loop saved mid-item comes back stopped, the item pending, steering dropped", () => {
    const loop = startItemRun(
      createLoop(taskPlan, { now: T0, sessionTokens: 0 }),
      "1",
      1,
      T0,
    );
    const state = sessionReducer(
      empty(),
      newSession(
        saved(
          {
            ...loop,
            answers: [
              {
                id: "a1",
                itemId: "1",
                text: "Use tabs",
                route: "steer",
                givenAt: T0.toISOString(),
              },
            ],
          },
          {
            queuedMessages: [
              {
                id: "m1",
                editorState: { type: "doc" },
                modifiers: { noContext: true, useCodebase: false },
                loopAnswerId: "a1",
              } as any,
              {
                id: "m2",
                editorState: { type: "doc" },
                modifiers: { noContext: true, useCodebase: false },
              },
            ],
          },
        ),
      ),
    );
    expect(state.loop?.status).toBe("stopped");
    expect(state.loop?.current).toBeUndefined();
    expect(state.loop?.items[0].status).toBe("pending");
    // The undelivered answer stays on the loop for the item's next run
    expect(state.loop?.answers[0].delivered).toBeUndefined();
    // Only the person's own queued message comes back
    expect(state.queuedMessages.map((m) => m.id)).toEqual(["m2"]);
  });

  it("a new session has no loop", () => {
    const loop = createLoop(taskPlan, { now: T0, sessionTokens: 0 });
    const loaded = sessionReducer(empty(), newSession(saved(loop)));
    expect(sessionReducer(loaded, newSession(undefined)).loop).toBeUndefined();
  });
});
