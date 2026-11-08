import type { ChatHistoryItem, ModelDescription } from "core";
import { readFileTool } from "core/tools/definitions/readFile";
import { createLoop, startItemRun } from "core/util/loopMode";
import { renderChatMessage } from "core/util/messageContent";
import { describe, expect, it } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import type { RootState } from "../store";
import { buildChatRequest } from "./buildChatRequest";

/* Loop mode's fresh context: a run's request starts at the run's own turns. */

const model: ModelDescription = {
  title: "Claude",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
};
const T0 = new Date("2026-11-07T10:00:00Z");
const plan = {
  items: [
    { id: "1", text: "Write the lexer", status: "completed" as const },
    { id: "2", text: "Add tests", status: "pending" as const },
  ],
  updatedAt: T0.toISOString(),
};

let n = 0;
const turn = (role: "user" | "assistant", content: string) =>
  ({
    message: { id: `m${++n}`, role, content },
    contextItems: [],
  }) as ChatHistoryItem & { message: { id: string } };

function stateWith(freshContext?: boolean): RootState {
  const state = getEmptyRootState();
  const history = [
    turn("user", "item one prompt"),
    turn("assistant", "item one done"),
    turn("user", "item two prompt"),
  ];
  const loop = startItemRun(
    createLoop(plan, { now: T0, sessionTokens: 0, freshContext }),
    "2",
    2,
    T0,
  );
  return {
    ...state,
    config: {
      ...state.config,
      config: {
        ...state.config.config,
        tools: [readFileTool],
        selectedModelByRole: {
          ...state.config.config.selectedModelByRole,
          chat: model,
        },
      },
    },
    session: { ...state.session, mode: "agent", history, loop },
  };
}

const texts = (state: RootState) =>
  buildChatRequest(state)
    .messages.filter((m) => m.role !== "system")
    .map(renderChatMessage);

describe("a loop item's request", () => {
  it("carries only the turns since the item started", () => {
    expect(texts(stateWith())).toEqual(["item two prompt"]);
  });

  it("carries the whole conversation when fresh context is off", () => {
    expect(texts(stateWith(false))).toEqual([
      "item one prompt",
      "item one done",
      "item two prompt",
    ]);
  });

  it("is unchanged outside a run", () => {
    const state = stateWith();
    const idle = {
      ...state,
      session: {
        ...state.session,
        loop: { ...state.session.loop!, current: undefined },
      },
    };
    expect(texts(idle)).toHaveLength(3);
  });
});
