import { act, fireEvent, waitFor } from "@testing-library/react";
import { newSession } from "../../../redux/slices/sessionSlice";
import { cancelStream } from "../../../redux/thunks/cancelStream";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  getMainEditor,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

const SLOW_REPLY = [
  { role: "assistant" as const, content: "Working" },
  { role: "assistant" as const, content: " on" },
  { role: "assistant" as const, content: " it." },
];

async function setup() {
  const rendered = await renderWithProviders(<Chat />);
  await act(async () => {
    addAndSelectMockLlm(rendered.store, rendered.ideMessenger);
  });
  // Keep the first turn streaming long enough to type during it
  rendered.ideMessenger.chatStreamDelay = 150;
  return rendered;
}

/** Type into the main input and press Enter, as a person would */
async function typeAndPressEnter(text: string) {
  const editor = await getMainEditor();
  await act(async () => {
    editor.commands.setContent(text);
  });
  await act(async () => {
    fireEvent.keyDown(editor.view.dom, { key: "Enter" });
  });
}

const userMessages = (store: { getState: () => any }) =>
  store
    .getState()
    .session.history.filter((h: any) => h.message.role === "user")
    .map((h: any) =>
      typeof h.message.content === "string"
        ? h.message.content
        : h.message.content.map((p: any) => p.text).join(""),
    );

describe("Queued messages", () => {
  test("Enter while the agent works queues the message and sends it when the turn ends", async () => {
    const { ideMessenger, store } = await setup();

    await sendInputWithMockedResponse(ideMessenger, "first", SLOW_REPLY);
    await waitFor(() =>
      expect(store.getState().session.isStreaming).toBe(true),
    );

    await typeAndPressEnter("second");
    await typeAndPressEnter("third");

    // Queued, shown, and nothing sent yet
    expect(store.getState().session.queuedMessages).toHaveLength(2);
    await getElementByTestId("queued-messages");
    expect(userMessages(store)).toEqual(["first"]);

    // When the turn ends, both go as one message
    ideMessenger.chatStreamDelay = 0;
    await waitFor(
      () => expect(userMessages(store)).toEqual(["first", "second\nthird"]),
      { timeout: 5000 },
    );
    expect(store.getState().session.queuedMessages).toHaveLength(0);
  }, 15000);

  test("Stop pauses the queue instead of sending it", async () => {
    const { ideMessenger, store } = await setup();

    await sendInputWithMockedResponse(ideMessenger, "first", SLOW_REPLY);
    await waitFor(() =>
      expect(store.getState().session.isStreaming).toBe(true),
    );
    await typeAndPressEnter("after stop");

    await act(async () => {
      await store.dispatch(cancelStream());
    });

    expect(store.getState().session.isQueuePaused).toBe(true);
    expect(store.getState().session.queuedMessages).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 300));
    expect(userMessages(store)).toEqual(["first"]);

    // Sent by hand
    ideMessenger.chatStreamDelay = 0;
    const sendAll = await getElementByTestId("queued-messages-send-all");
    await act(async () => {
      sendAll.click();
    });
    await waitFor(() =>
      expect(userMessages(store)).toEqual(["first", "after stop"]),
    );
    expect(store.getState().session.isQueuePaused).toBe(false);
  });

  test("Edit moves a queued message back into the input; remove drops it", async () => {
    const { ideMessenger, store } = await setup();

    await sendInputWithMockedResponse(ideMessenger, "first", SLOW_REPLY);
    await waitFor(() =>
      expect(store.getState().session.isStreaming).toBe(true),
    );
    await typeAndPressEnter("fix the typo");
    await typeAndPressEnter("never mind");

    const [editButton] = document.querySelectorAll<HTMLElement>(
      "[data-testid=queued-message-edit]",
    );
    await act(async () => {
      editButton.click();
    });
    expect((await getMainEditor()).getText()).toContain("fix the typo");

    const removeButton = document.querySelector<HTMLElement>(
      "[data-testid=queued-message-remove]",
    )!;
    await act(async () => {
      removeButton.click();
    });
    expect(store.getState().session.queuedMessages).toHaveLength(0);
  });

  test("A queued message is saved with the session right away, mid-turn", async () => {
    const { ideMessenger, store } = await setup();
    const saves: any[] = [];
    ideMessenger.responseHandlers["history/save"] = async (session: any) => {
      saves.push(session);
      return undefined as any;
    };

    await sendInputWithMockedResponse(ideMessenger, "first", SLOW_REPLY);
    await waitFor(() =>
      expect(store.getState().session.isStreaming).toBe(true),
    );
    await typeAndPressEnter("do not lose me");

    // Saved while the turn is still running
    await waitFor(() =>
      expect(
        saves.some((s) =>
          JSON.stringify(s.queuedMessages ?? []).includes("do not lose me"),
        ),
      ).toBe(true),
    );
    expect(store.getState().session.isStreaming).toBe(true);
  });

  test("A session loaded with saved queued messages (e.g. after a reload) restores them paused", async () => {
    const { store } = await setup();
    const queued = {
      id: "saved-1",
      editorState: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "resume me" }] },
        ],
      },
      modifiers: { useCodebase: false, noContext: false },
    };

    await act(async () => {
      store.dispatch(
        newSession({
          sessionId: "restored",
          title: "Restored",
          workspaceDirectory: "",
          history: [
            {
              message: { role: "user", content: "earlier" },
              contextItems: [],
            },
          ],
          queuedMessages: [queued],
        }),
      );
    });

    expect(store.getState().session.queuedMessages).toEqual([queued]);
    expect(store.getState().session.isQueuePaused).toBe(true);
    const bar = await getElementByTestId("queued-messages");
    expect(bar.textContent).toContain("resume me");
    expect(bar.textContent).toContain("paused");
    await new Promise((r) => setTimeout(r, 300));
    expect(userMessages(store)).toEqual(["earlier"]);
  });

  test("A session saved while a tool ran restores the tool as interrupted, and its queue can be sent", async () => {
    const { ideMessenger, store } = await setup();
    const queued = {
      id: "saved-1",
      editorState: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "next step" }] },
        ],
      },
      modifiers: { useCodebase: false, noContext: false },
    };

    await act(async () => {
      store.dispatch(
        newSession({
          sessionId: "restored",
          title: "Restored",
          workspaceDirectory: "",
          history: [
            {
              message: { role: "user", content: "run it" },
              contextItems: [],
            },
            {
              message: {
                role: "assistant",
                content: "",
                toolCalls: [
                  {
                    id: "tc-1",
                    type: "function",
                    function: { name: "run_terminal_command", arguments: "{}" },
                  },
                ],
              },
              contextItems: [],
              toolCallStates: [
                {
                  toolCallId: "tc-1",
                  status: "calling",
                  parsedArgs: {},
                  toolCall: {
                    id: "tc-1",
                    type: "function",
                    function: { name: "run_terminal_command", arguments: "{}" },
                  },
                },
              ],
            } as any,
          ],
          queuedMessages: [queued],
        }),
      );
    });

    const toolCall = store.getState().session.history[1].toolCallStates![0];
    expect(toolCall.status).toBe("errored");
    expect(toolCall.output?.[0]?.name).toBe("Interrupted");

    // Nothing looks busy, so Send all sends rather than waiting on the tool
    ideMessenger.chatStreamDelay = 0;
    const sendAll = await getElementByTestId("queued-messages-send-all");
    await act(async () => {
      sendAll.click();
    });
    await waitFor(() =>
      expect(userMessages(store)).toEqual(["run it", "next step"]),
    );
  });
});
