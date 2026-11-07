import type { ChatHistoryItem, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../../redux/slices/configSlice";
import { newSession } from "../../../redux/slices/sessionSlice";
import { setupStore } from "../../../redux/store";
import { renderWithProviders } from "../../../util/test/render";
import { PlanCard } from "./PlanCard";

const PLAN_URI = "file:///Users/user/workspace1/.continue/plans/add-retry.md";
const FILE =
  "# Add retry\n\nWrap it.\n\n## To-dos\n\n- [ ] Add a helper <!-- id: 1 -->\n- [ ] Use it <!-- id: 2 -->\n";

const toolCallState: ToolCallState = {
  toolCallId: "plan-1",
  toolCall: {
    id: "plan-1",
    type: "function",
    function: { name: BuiltInToolNames.PresentPlan, arguments: "{}" },
  },
  parsedArgs: {
    title: "Add retry",
    plan: "Wrap **upload()** in a retry.",
    todos: ["Add a helper", "Use it"],
  },
  status: "done",
  output: [
    {
      name: "Add retry",
      description: ".continue/plans/add-retry.md",
      content: "Plan saved",
      uri: { type: "file", value: PLAN_URI },
    },
  ],
};

function history(extra: ChatHistoryItem[] = []): ChatHistoryItem[] {
  return [
    {
      message: { role: "user", content: "Plan a retry" },
      contextItems: [],
    },
    {
      message: { role: "assistant", content: "" },
      contextItems: [],
      toolCallStates: [toolCallState],
    },
    ...extra,
  ];
}

async function setup(items = history()) {
  const ideMessenger = new MockIdeMessenger();
  ideMessenger.responseHandlers.readFile = async () => FILE;
  // Enough for Build's turn to run to its end.
  ideMessenger.responses["llm/compileChat"] = {
    compiledChatMessages: [{ role: "user", content: "Build" }],
    didPrune: false,
    contextPercentage: 0.1,
  };
  ideMessenger.setChatResponseText("Building.");
  const openFile = vi.fn().mockResolvedValue(undefined);
  ideMessenger.ide.openFile = openFile;
  const store = setupStore({ ideMessenger });
  const model = {
    title: "Test model",
    model: "test-model",
    provider: "anthropic",
    underlyingProviderName: "anthropic",
  };
  // Mount first: the app's listeners settle the session on mount.
  await renderWithProviders(
    <PlanCard toolCallState={toolCallState} historyIndex={1} />,
    { store, mockIdeMessenger: ideMessenger },
  );
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: model,
        },
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [model] },
      } as any),
    );
    store.dispatch(
      newSession({
        sessionId: "s1",
        title: "Plan",
        workspaceDirectory: "",
        history: items,
        mode: "plan",
        planFile: PLAN_URI,
      }),
    );
  });
  return { store, openFile };
}

describe("PlanCard", () => {
  it("shows the plan, its to-dos and a link to the file", async () => {
    const { openFile } = await setup();
    expect(screen.getByTestId("plan-card").textContent).toContain("Add retry");
    expect(screen.getByTestId("plan-card-todos").textContent).toContain(
      "Use it",
    );
    fireEvent.click(screen.getByTestId("plan-card-open"));
    expect(openFile).toHaveBeenCalledWith(PLAN_URI);
  });

  it("Keep planning stays in Plan mode and sends nothing", async () => {
    const { store } = await setup();
    await act(async () => {
      fireEvent.click(screen.getByTestId("plan-card-keep-planning"));
    });
    expect(store.getState().session.mode).toBe("plan");
    expect(store.getState().session.history).toHaveLength(2);
    expect(screen.getByTestId("plan-card-build")).toBeTruthy();
  });

  it("Build switches to Agent mode and sends the build message", async () => {
    const { store } = await setup();
    await act(async () => {
      fireEvent.click(screen.getByTestId("plan-card-build"));
    });
    await waitFor(() =>
      expect(store.getState().session.history.length).toBeGreaterThan(2),
    );
    const state = store.getState().session;
    expect(state.mode).toBe("agent");
    const sent = state.history[2];
    expect(sent.message.role).toBe("user");
    expect(JSON.stringify(sent.editorState)).toContain(
      "Build the plan in .continue/plans/add-retry.md",
    );
  });

  it("hides the buttons once something was sent after the plan", async () => {
    await setup(
      history([
        {
          message: { role: "user", content: "Smaller steps" },
          contextItems: [],
        },
        {
          message: { role: "assistant", content: "Revising." },
          contextItems: [],
        },
      ]),
    );
    expect(screen.queryByTestId("plan-card-build")).toBeNull();
    expect(screen.queryByTestId("plan-card-keep-planning")).toBeNull();
  });
});
