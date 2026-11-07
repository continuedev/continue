import { act, waitFor } from "@testing-library/react";
import { ChatMessage } from "core";
import { callToolById } from "../../../redux/thunks/callToolById";
import { cancelStream } from "../../../redux/thunks/cancelStream";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import { sendInputWithMockedResponse } from "../../../util/test/utils";
import { Chat } from "../Chat";

const READ_FILE_CALL: ChatMessage[] = [
  {
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id: "tool-call-1",
        type: "function",
        function: {
          name: "read_file",
          arguments: '{"filepath": "test.js"}',
        },
      },
    ],
  },
];

const findToolCall = (store: { getState: () => any }) =>
  store
    .getState()
    .session.history.flatMap((h: any) => h.toolCallStates ?? [])
    .find((tc: any) => tc.toolCallId === "tool-call-1");
const toolStatus = (store: { getState: () => any }) =>
  findToolCall(store)?.status;

test("Stop while an approved tool runs: the result is kept but the agent does not continue", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);
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

  await sendInputWithMockedResponse(ideMessenger, "read it", READ_FILE_CALL);

  // The call waits for approval; approve it as the Accept button does
  await waitFor(() => expect(toolStatus(store)).toBe("generated"));
  void store.dispatch(callToolById({ toolCallId: "tool-call-1" }));
  await toolStarted;

  // Stop while the tool is still running, then let it finish
  await act(async () => {
    await store.dispatch(cancelStream());
  });
  await act(async () => {
    releaseTool();
    await new Promise((r) => setTimeout(r, 300));
  });

  // The tool's result is recorded, and no second request was made
  await waitFor(() => expect(toolStatus(store)).toBe("done"));
  expect(findToolCall(store)?.output?.[0]?.content).toBe("contents");
  expect(streamChat).toHaveBeenCalledTimes(1);
  expect(store.getState().session.isStreaming).toBe(false);
});
