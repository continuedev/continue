import type { ModelDescription, TaskPlan } from "core";
import { taskListTool } from "core/tools/definitions/taskList";
import { readFileTool } from "core/tools/definitions/readFile";
import { describe, expect, it } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import { selectActiveTools } from "../selectors/selectActiveTools";
import type { RootState } from "../store";
import { buildChatRequest } from "./buildChatRequest";

const model: ModelDescription = {
  title: "Claude",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
};

const plan: TaskPlan = {
  items: [
    { id: "1", text: "Read the code", status: "completed" },
    { id: "2", text: "Fix the bug", status: "in_progress" },
  ],
  updatedAt: "2026-11-06T12:00:00.000Z",
};

function stateWith(
  mode: RootState["session"]["mode"],
  taskPlan?: TaskPlan,
): RootState {
  const state = getEmptyRootState();
  return {
    ...state,
    config: {
      ...state.config,
      config: {
        ...state.config.config,
        tools: [readFileTool, taskListTool],
        selectedModelByRole: {
          ...state.config.config.selectedModelByRole,
          chat: model,
        },
      },
    },
    session: {
      ...state.session,
      mode,
      taskPlan,
      history: [
        {
          message: { id: "u1", role: "user", content: "fix it" },
          contextItems: [],
        },
      ],
    },
  };
}

describe("the task list in the request", () => {
  it("is offered in Agent and Plan modes only", () => {
    const names = (mode: RootState["session"]["mode"]) =>
      selectActiveTools(stateWith(mode)).map((t) => t.function.name);
    expect(names("agent")).toContain("task_list");
    expect(names("plan")).toContain("task_list");
    expect(names("chat")).not.toContain("task_list");
    expect(names("background")).not.toContain("task_list");
  });

  it("comes as a separate tail message, not inside the history", () => {
    const request = buildChatRequest(stateWith("agent", plan));
    expect(request.taskListMessage).toEqual({
      role: "user",
      content: expect.stringMatching(/^<task_list>\n/),
    });
    const content = String(request.taskListMessage?.content);
    expect(content).toContain("[x] 1. Read the code");
    expect(content).toContain("[>] 2. Fix the bug");
    // The conversation messages (and the system message) do not carry it.
    for (const m of request.messages) {
      expect(String(m.content)).not.toContain("<task_list>");
    }
  });

  it("leaves the conversation messages unchanged when the list changes", () => {
    const before = buildChatRequest(stateWith("agent", plan));
    const after = buildChatRequest(
      stateWith("agent", {
        ...plan,
        items: [
          ...plan.items,
          { id: "3", text: "Run the tests", status: "pending" },
        ],
      }),
    );
    expect(JSON.stringify(after.messages)).toBe(
      JSON.stringify(before.messages),
    );
    expect(after.taskListMessage).not.toEqual(before.taskListMessage);
  });

  it("is absent without a list, or when the tool is not offered", () => {
    expect(
      buildChatRequest(stateWith("agent")).taskListMessage,
    ).toBeUndefined();
    expect(
      buildChatRequest(stateWith("chat", plan)).taskListMessage,
    ).toBeUndefined();
  });
});
