import { act, fireEvent, waitFor } from "@testing-library/react";
import { ChatMessage } from "core";
import { callToolById } from "../../../redux/thunks/callToolById";
import { cancelStream } from "../../../redux/thunks/cancelStream";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getMainEditor,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

const READ_FILE_CALL: ChatMessage[] = [
  {
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id: "tool-call-1",
        type: "function",
        function: { name: "read_file", arguments: '{"filepath": "test.js"}' },
      },
    ],
  },
];
const FINAL_REPLY: ChatMessage[] = [{ role: "assistant", content: "Done." }];

const toolStatus = (store: { getState: () => any }) =>
  store
    .getState()
    .session.history.flatMap((h: any) => h.toolCallStates ?? [])
    .find((tc: any) => tc.toolCallId === "tool-call-1")?.status;

const text = (message: any) =>
  typeof message.content === "string"
    ? message.content
    : message.content.map((p: any) => p.text ?? "").join("");

async function typeAndPressEnter(value: string) {
  const editor = await getMainEditor();
  await act(async () => {
    editor.commands.setContent(value);
  });
  await act(async () => {
    fireEvent.keyDown(editor.view.dom, { key: "Enter" });
  });
}

/** A turn whose read_file call is approved and then held until released */
async function startTurnWithRunningTool() {
  const rendered = await renderWithProviders(<Chat />);
  const { ideMessenger, store } = rendered;
  await act(async () => {
    addAndSelectMockLlm(store, ideMessenger);
  });
  ideMessenger.responses["context/getSymbolsForFiles"] = {};

  let releaseTool: () => void = () => {};
  const toolStarted = new Promise<void>((started) => {
    ideMessenger.responseHandlers["tools/call"] = async () => {
      started();
      await new Promise<void>((release) => (releaseTool = release));
      return {
        contextItems: [
          { name: "test.js", description: "test.js", content: "contents" },
        ],
      };
    };
  });
  const streamChat = vi.spyOn(ideMessenger, "llmStreamChat");
  // The messages of each request, as the gui built them
  const requests: ChatMessage[][] = [];
  ideMessenger.responseHandlers["llm/compileChat"] = async ({
    messages,
  }: any) => {
    requests.push(messages);
    return {
      compiledChatMessages: messages,
      didPrune: false,
      contextPercentage: 0.5,
    };
  };

  await sendInputWithMockedResponse(ideMessenger, "read it", READ_FILE_CALL);
  await waitFor(() => expect(toolStatus(store)).toBe("generated"));
  void store.dispatch(callToolById({ toolCallId: "tool-call-1" }));
  await toolStarted;
  return {
    ...rendered,
    streamChat,
    requests,
    release: () => releaseTool(),
  };
}

describe("Steering with queued messages", () => {
  test("Send now while a tool runs delivers the message after the tool result, in the same turn", async () => {
    const { ideMessenger, store, streamChat, requests, release } =
      await startTurnWithRunningTool();

    await typeAndPressEnter("also check the tests");
    expect(store.getState().session.queuedMessages).toHaveLength(1);

    const send = document.querySelector<HTMLElement>(
      "[data-testid=queued-message-send]",
    )!;
    await act(async () => {
      send.click();
    });
    // Marked to go at the next tool boundary; the turn keeps going
    expect(store.getState().session.queuedMessages[0].steer).toBe(true);
    expect(toolStatus(store)).toBe("calling");
    expect(
      document.querySelector("[data-testid=queued-message-steer]"),
    ).not.toBeNull();

    ideMessenger.chatResponse = FINAL_REPLY;
    await act(async () => {
      release();
    });

    await waitFor(() => expect(streamChat).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(store.getState().session.isStreaming).toBe(false),
    );

    // The second request carries the tool result, then the steering text.
    // (The mock model takes tools in the system message, so the result is a
    // user message here; with native tools it is a tool message, which the
    // providers merge with this text into one user turn.)
    const messages = requests[1].filter((m) => m.role !== "system");
    expect(text(messages.at(-2))).toContain("contents");
    expect(text(messages.at(-1))).toContain("also check the tests");
    expect(messages.at(-1)?.role).toBe("user");

    expect(store.getState().session.queuedMessages).toHaveLength(0);
    expect(text(store.getState().session.history.at(-1)?.message)).toBe(
      "Done.",
    );
  });

  test("A queued message not sent now waits for the turn to end", async () => {
    const { ideMessenger, streamChat, requests, release } =
      await startTurnWithRunningTool();

    await typeAndPressEnter("afterwards, summarise");
    ideMessenger.chatResponse = FINAL_REPLY;
    await act(async () => {
      release();
    });

    // Not in the request after the tool; sent as its own message at the end
    await waitFor(() => expect(streamChat).toHaveBeenCalledTimes(3), {
      timeout: 5000,
    });
    const afterTool = requests[1];
    expect(text(afterTool.at(-1))).toContain("contents");
    expect(text(afterTool.at(-1))).not.toContain("afterwards");
    const atEnd = requests[2];
    expect(text(atEnd.at(-1))).toContain("afterwards, summarise");
  });

  test("Stop cancels steering and pauses the queue", async () => {
    const { store, streamChat, release } = await startTurnWithRunningTool();

    await typeAndPressEnter("steer me");
    await act(async () => {
      document
        .querySelector<HTMLElement>("[data-testid=queued-message-send]")!
        .click();
    });
    await act(async () => {
      await store.dispatch(cancelStream());
    });
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(streamChat).toHaveBeenCalledTimes(1);
    expect(store.getState().session.isQueuePaused).toBe(true);
    expect(store.getState().session.queuedMessages).toEqual([
      expect.objectContaining({ steer: undefined }),
    ]);
  });
});
