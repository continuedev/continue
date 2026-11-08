import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it, vi } from "vitest";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { RootState } from "../store";
import { callToolById } from "./callToolById";

/**
 * present_plan ends the turn: its result is recorded in the history, but
 * nothing is sent to the model until the person chooses Build.
 */
describe("callToolById with present_plan", () => {
  it("records the result, seeds the list and does not call the model", async () => {
    const state = getEmptyRootState();
    state.config.config.selectedModelByRole.chat = {
      title: "Test model",
      model: "test-model",
      provider: "anthropic",
      underlyingProviderName: "anthropic",
    };
    state.session.mode = "plan";
    state.session.isStreaming = true;
    state.session.history = [
      {
        message: { id: "u1", role: "user", content: "Plan a retry" },
        contextItems: [],
      },
      {
        message: { id: "a1", role: "assistant", content: "" },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "plan-1",
            toolCall: {
              id: "plan-1",
              type: "function",
              function: {
                name: BuiltInToolNames.PresentPlan,
                arguments: "{}",
              },
            },
            parsedArgs: {
              title: "Add retry",
              plan: "Wrap it.",
              todos: ["Add a helper", "Use it"],
            },
            status: "generated",
          },
        ],
      },
    ];
    // A message queued while the plan was written goes once the turn ends
    state.session.queuedMessages = [
      {
        id: "q1",
        editorState: { type: "doc", content: [] },
        modifiers: { useCodebase: false, noContext: false },
      },
    ];
    const store = createMockStore(state);
    const messenger = store.mockIdeMessenger;
    messenger.responses.fileExists = false;
    const writeFile = vi.fn();
    messenger.responseHandlers.writeFile = async (data: any) => {
      writeFile(data);
    };
    const stream = vi.spyOn(messenger, "llmStreamChat");

    await store.dispatch(callToolById({ toolCallId: "plan-1" }) as any);

    const session = (store.getState() as RootState).session;
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "file:///Users/user/workspace1/.continuous/plans/add-retry.md",
      }),
    );
    expect(session.taskPlan?.items.map((i: any) => i.text)).toEqual([
      "Add a helper",
      "Use it",
    ]);
    expect(session.planFile).toBe(
      "file:///Users/user/workspace1/.continuous/plans/add-retry.md",
    );
    expect(session.history[1].toolCallStates?.[0].status).toBe("done");
    // The tool result is in the history, so the next request is well formed.
    expect(session.history.at(-1)?.message).toMatchObject({
      role: "tool",
      toolCallId: "plan-1",
    });
    expect(stream).not.toHaveBeenCalled();
    expect(session.isStreaming).toBe(false);
    expect(session.isQueueSendRequested).toBe(true);
  });
});
