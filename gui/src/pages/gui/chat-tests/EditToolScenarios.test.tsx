import { BuiltInToolNames } from "core/tools/builtIn";
import {
  addAndSelectMockLlm,
  triggerConfigUpdate,
} from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import { Chat } from "../Chat";

import { waitFor } from "@testing-library/dom";
import { ChatMessage } from "core";
import { toggleToolSetting } from "../../../redux/slices/uiSlice";
import {
  getElementByTestId,
  getElementByText,
  logAllTestIds,
  sendInputWithMockedResponse,
  verifyNotPresentByTestId,
} from "./utils";

const EDIT_WORKSPACE_DIR = "file:///workspace";
const EDIT_FILEPATH = "test.txt";
const EDIT_FILE_URI = `${EDIT_WORKSPACE_DIR}/${EDIT_FILEPATH}`;
const EDIT_CHANGES = "New content";
const EDIT_TOOL_CALL_ID = "known-id";
const EDIT_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id: EDIT_TOOL_CALL_ID,
        function: {
          name: BuiltInToolNames.EditExistingFile,
          arguments: JSON.stringify({
            filepath: EDIT_FILEPATH,
            changes: EDIT_CHANGES,
          }),
        },
      },
    ],
  },
];

const POST_EDIT_RESPONSE = "Edit applied successfully";
const AFTER_EDIT_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content: POST_EDIT_RESPONSE,
  },
];
beforeEach(() => {
  vi.clearAllMocks();
});

test("Edit run with ask first policy and no auto apply", async () => {
  const { ideMessenger, store, user } = await renderWithProviders(<Chat />);

  ideMessenger.responses["getWorkspaceDirs"] = [EDIT_WORKSPACE_DIR];
  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  addAndSelectMockLlm(store, ideMessenger);

  await sendInputWithMockedResponse(
    ideMessenger,
    "Edit this file",
    EDIT_MESSAGES,
  );

  // Toggle the codeblock and make sure the changes show

  const toggleCodeblockChevron = await getElementByTestId("toggle-codeblock");

  await user.click(toggleCodeblockChevron);
  await getElementByText(EDIT_CHANGES);

  const acceptToolCallButton = await getElementByTestId(
    "accept-tool-call-button",
  );
  await user.click(acceptToolCallButton);

  await waitFor(() => {
    expect(messengerPostSpy).toHaveBeenCalledWith("applyToFile", {
      streamId: expect.any(String),
      filepath: EDIT_FILE_URI,
      text: EDIT_CHANGES,
      toolCallId: EDIT_TOOL_CALL_ID,
    });
  });

  const streamId = messengerPostSpy.mock.calls.find(
    (call) => call[0] === "applyToFile",
  )?.[1]?.streamId;
  expect(streamId).toBeDefined();

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "streaming",
    streamId,
    toolCallId: EDIT_TOOL_CALL_ID,
    filepath: EDIT_FILEPATH,
  });

  await getElementByTestId("notch-applying-text");
  await getElementByTestId("notch-applying-cancel-button");

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId,
    toolCallId: EDIT_TOOL_CALL_ID,
    filepath: EDIT_FILEPATH,
  });

  const acceptButton = await getElementByTestId("edit-accept-button");
  await getElementByTestId("edit-reject-button");

  ideMessenger.setChatResponseText(POST_EDIT_RESPONSE);

  await user.click(acceptButton);

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "closed",
    streamId,
    toolCallId: EDIT_TOOL_CALL_ID,
    filepath: EDIT_FILEPATH,
  });

  await getElementByText(POST_EDIT_RESPONSE);
});

test.skip("Edit run with no policy and yolo mode", async () => {
  const { ideMessenger, store, user } = await renderWithProviders(<Chat />);
  const messengerPostSpy = vi.spyOn(ideMessenger, "post");
  addAndSelectMockLlm(store, ideMessenger);

  store.dispatch(toggleToolSetting(BuiltInToolNames.EditExistingFile));
  triggerConfigUpdate({
    store,
    ideMessenger,
    editConfig: (current) => {
      current.ui = {
        ...current.ui,
        autoAcceptEditToolDiffs: true, // Enable auto-accept for edit tool diffs
      };
      return current;
    },
  });
  expect(store.getState().config.config.ui?.autoAcceptEditToolDiffs).toBe(true);

  await sendInputWithMockedResponse(
    ideMessenger,
    "Edit this file",
    EDIT_MESSAGES,
  );

  // Toggle the codeblock and make sure the changes show
  const toggleCodeblockChevron = await getElementByTestId("toggle-codeblock");
  await user.click(toggleCodeblockChevron);

  await getElementByText(EDIT_CHANGES);

  await verifyNotPresentByTestId("accept-tool-call-button"); // Checks tool policy

  const applyStates = store.getState().session.codeBlockApplyStates.states;
  const initialToolApplyState = applyStates.find(
    (s) => s.toolCallId === EDIT_TOOL_CALL_ID,
  );

  expect(initialToolApplyState).toBeDefined();
  const streamId = initialToolApplyState!.streamId;

  ideMessenger.setChatResponseText(POST_EDIT_RESPONSE);
  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "closed",
    streamId,
    toolCallId: EDIT_TOOL_CALL_ID,
    filepath: EDIT_FILEPATH,
  });
  await getElementByText(POST_EDIT_RESPONSE);

  logAllTestIds(); // // Should be auto triggered

  // await waitFor(() => {
  //   expect(messengerPostSpy).toHaveBeenCalledWith("acceptDiff", {});
  // });

  // await verifyNotPresentByTestId("edit-accept-button");
  // await verifyNotPresentByTestId("edit-reject-button");

  // ideMessenger.setChatResponseText(POST_EDIT_RESPONSE);

  // await getElementByText(POST_EDIT_RESPONSE);
});
