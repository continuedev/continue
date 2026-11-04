import { describe, expect, it } from "vitest";
import { findTurnIdForIndex, getTurnOrder } from "../../util/restoreCheckpoint";
import {
  addCheckpointSnapshot,
  INITIAL_SESSION_STATE,
  newSession,
  sessionSlice,
  setCheckpoints,
} from "./sessionSlice";

const reducer = sessionSlice.reducer;
const file = (uri: string, content: string) => ({
  uri,
  existed: true,
  content,
});

describe("session checkpoints", () => {
  it("records snapshots per turn, keeping the first per file", () => {
    let state = reducer(
      INITIAL_SESSION_STATE,
      addCheckpointSnapshot({ turnId: "t1", file: file("f", "v0") }),
    );
    state = reducer(
      state,
      addCheckpointSnapshot({ turnId: "t1", file: file("f", "v1") }),
    );
    state = reducer(
      state,
      addCheckpointSnapshot({ turnId: "t2", file: file("f", "v1") }),
    );
    expect(
      state.checkpoints.map((c) => [c.turnId, c.files[0].content]),
    ).toEqual([
      ["t1", "v0"],
      ["t2", "v1"],
    ]);
  });

  it("loads checkpoints from a saved session and clears them for a new one", () => {
    const saved = {
      sessionId: "s1",
      title: "t",
      workspaceDirectory: "",
      history: [],
      checkpoints: [{ turnId: "t1", createdAt: 1, files: [file("f", "v0")] }],
    };
    let state = reducer(INITIAL_SESSION_STATE, newSession(saved));
    expect(state.checkpoints).toEqual(saved.checkpoints);
    state = reducer(state, newSession());
    expect(state.checkpoints).toEqual([]);
  });

  it("setCheckpoints replaces the list", () => {
    const state = reducer(
      {
        ...INITIAL_SESSION_STATE,
        checkpoints: [{ turnId: "t1", createdAt: 1, files: [] }],
      },
      setCheckpoints([]),
    );
    expect(state.checkpoints).toEqual([]);
  });
});

describe("turn helpers", () => {
  const history = [
    { message: { role: "user", id: "u1", content: "a" } },
    { message: { role: "assistant", id: "a1", content: "b" } },
    { message: { role: "assistant", id: "a2", content: "c" } },
    { message: { role: "user", id: "u2", content: "d" } },
    { message: { role: "assistant", id: "a3", content: "e" } },
  ] as any;

  it("orders turns by user message", () => {
    expect(getTurnOrder(history)).toEqual(["u1", "u2"]);
  });

  it("finds the turn an assistant message belongs to", () => {
    expect(findTurnIdForIndex(history, 2)).toBe("u1");
    expect(findTurnIdForIndex(history, 4)).toBe("u2");
  });
});
