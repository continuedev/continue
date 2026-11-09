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

describe("a loop item's plan block", () => {
  const withPlan = (state: RootState): RootState => ({
    ...state,
    session: { ...state.session, taskPlan: plan },
  });

  it("goes after the item prompt, with every slot and the running item marked", () => {
    const request = buildChatRequest(withPlan(stateWith()));
    // Not last: a block after the newest message moves with every request
    // and breaks a prompt cache there
    expect(request.taskListMessage).toBeUndefined();
    const [prompt] = texts(withPlan(stateWith()));
    expect(prompt.startsWith("item two prompt\n\n<task_list>")).toBe(true);
    expect(prompt).toContain("[x] 1. Write the lexer");
    expect(prompt).toContain("[>] 2. Add tests  <- this item");
    expect(prompt).toContain("report it with finish_item");
  });

  it("stays as the run started while the run goes on", () => {
    const state = withPlan(stateWith());
    const [before] = texts(state);
    const loop = state.session.loop!;
    const changed = {
      ...state,
      session: {
        ...state.session,
        loop: {
          ...loop,
          items: loop.items.map((i) =>
            i.id === "1" ? { ...i, summary: "changed meanwhile" } : i,
          ),
        },
      },
    };
    expect(texts(changed)[0]).toBe(before);
    // The kept history is not changed
    expect(renderChatMessage(state.session.history.at(-1)!.message)).toBe(
      "item two prompt",
    );
  });

  it("is not sent outside an item's run", () => {
    const state = withPlan(stateWith());
    const idle = {
      ...state,
      session: {
        ...state.session,
        loop: { ...state.session.loop!, current: undefined },
      },
    };
    // The task list tool is not among this state's tools either
    expect(buildChatRequest(idle).taskListMessage).toBeUndefined();
  });
});

describe("a loop turn's reasoning effort", () => {
  const withEffort = (state: RootState, modeModels: any): RootState => ({
    ...state,
    config: {
      ...state.config,
      config: { ...state.config.config, modeModels },
    },
  });

  it("an item takes modeModels.loop's effort, not the mode's", () => {
    const state = withEffort(stateWith(), {
      agent: { title: "Claude", reasoningEffort: "high" },
      loop: { title: "Claude", reasoningEffort: "off" },
    });
    expect(buildChatRequest(state).completionOptions).toMatchObject({
      reasoning: false,
    });
  });

  it("falls back to the agent entry when loop sets none", () => {
    const state = withEffort(stateWith(), {
      agent: { title: "Claude", reasoningEffort: "low" },
    });
    expect(buildChatRequest(state).completionOptions).toMatchObject({
      reasoning: true,
      reasoningBudgetTokens: 1024,
    });
  });
});
