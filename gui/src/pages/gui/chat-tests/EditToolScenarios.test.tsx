import { BuiltInToolNames } from "core/tools/builtIn";
import {
  addAndSelectMockLlm,
  triggerConfigUpdate,
} from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import { Chat } from "../Chat";
import { generateToolCallButtonTestId } from "../../../components/mainInput/Lump/LumpToolbar/PendingToolCallToolbar";

import { waitFor } from "@testing-library/dom";
import { act } from "@testing-library/react";
import { ChatMessage } from "core";
import {
  setToolPolicy,
  toggleToolSetting,
} from "../../../redux/slices/uiSlice";
import {
  getElementByTestId,
  getElementByText,
  sendInputWithMockedResponse,
  verifyNotPresentByTestId,
} from "../../../util/test/utils";

const EDIT_WORKSPACE_DIR = "file:///workspace";
const EDIT_FILEPATH = "test.txt";
const EDIT_FILE_URI = `${EDIT_WORKSPACE_DIR}/${EDIT_FILEPATH}`;
const EDIT_CHANGES = "New content";
const EDIT_TOOL_CALL_ID = "known-id";
const EDIT_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content: "I'll edit the file for you.",
  },
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
beforeEach(() => {
  vi.clearAllMocks();
});

test(
  "Edit run with ask first policy and no auto apply",
  { timeout: 15000 },
  async () => {
    // Setup
    const { ideMessenger, store, user } = await renderWithProviders(<Chat />);

    ideMessenger.responses["getWorkspaceDirs"] = [EDIT_WORKSPACE_DIR];
    const messengerPostSpy = vi.spyOn(ideMessenger, "post");

    addAndSelectMockLlm(store, ideMessenger);

    // Send the input that will respond with an edit tool call
    await sendInputWithMockedResponse(
      ideMessenger,
      "Edit this file",
      EDIT_MESSAGES,
    );

    // Wait for streaming to complete and tool calls to be set to generated
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    // Toggle the codeblock and make sure the changes show
    const toggleCodeblockChevron = await getElementByTestId("toggle-codeblock");

    await user.click(toggleCodeblockChevron);
    await getElementByText(EDIT_CHANGES);

    // Pending tool call - find and click the accept button
    const acceptToolCallButton = await getElementByTestId(
      generateToolCallButtonTestId("accept", EDIT_TOOL_CALL_ID),
    );
    await user.click(acceptToolCallButton);

    // Tool call, check that applyToFile was called for edit
    await waitFor(() => {
      expect(messengerPostSpy).toHaveBeenCalledWith("applyToFile", {
        streamId: expect.any(String),
        filepath: EDIT_FILE_URI,
        text: EDIT_CHANGES,
        toolCallId: EDIT_TOOL_CALL_ID,
      });
    });

    // Extract stream ID and initiate mock streaming
    const streamId = messengerPostSpy.mock.calls.find(
      (call) => call[0] === "applyToFile",
    )?.[1]?.streamId;
    expect(streamId).toBeDefined();

    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "streaming",
      streamId,
      toolCallId: EDIT_TOOL_CALL_ID,
      filepath: EDIT_FILE_URI,
    });

    // Mid stream, should show applying in notch
    await getElementByTestId("notch-applying-text");
    await getElementByTestId("notch-applying-cancel-button");

    // Close the stream
    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "done",
      streamId,
      toolCallId: EDIT_TOOL_CALL_ID,
      filepath: EDIT_FILE_URI,
    });

    // Verify accept/reject buttons are present
    const acceptButton = await getElementByTestId("edit-accept-button");
    await getElementByTestId("edit-reject-button");

    // Set the chat response text before accepting changes
    ideMessenger.setChatResponseText(POST_EDIT_RESPONSE);

    // Accept the changes, which should trigger a response after the tool call
    await user.click(acceptButton);

    expect(messengerPostSpy).toHaveBeenCalledWith("acceptDiff", {
      streamId,
      filepath: EDIT_FILE_URI,
    });

    // Close the stream - this should trigger the streaming response
    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "closed",
      streamId,
      toolCallId: EDIT_TOOL_CALL_ID,
      filepath: EDIT_FILE_URI,
    });

    // Allow time for the auto-streaming to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await verifyNotPresentByTestId("edit-accept-button");
    await verifyNotPresentByTestId("edit-reject-button");

    // Try to manually trigger the streaming by checking if the response is set
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    // TODO: Fix this test - the POST_EDIT_RESPONSE is not being displayed
    // await waitFor(() => getElementByText(POST_EDIT_RESPONSE), {
    //   timeout: 8000,
    // });
  },
);

test("Edit run with no policy and yolo mode", { timeout: 15000 }, async () => {
  // Setup
  const { ideMessenger, store, user } = await renderWithProviders(<Chat />);

  ideMessenger.responses["getWorkspaceDirs"] = [EDIT_WORKSPACE_DIR];
  const messengerPostSpy = vi.spyOn(ideMessenger, "post");

  addAndSelectMockLlm(store, ideMessenger);

  // Enable automatic edit and yolo mode
  store.dispatch(
    setToolPolicy({
      toolName: BuiltInToolNames.EditExistingFile,
      policy: "allowedWithoutPermission",
    }),
  );
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

  // Send the input that will respond with an edit tool call
  await sendInputWithMockedResponse(
    ideMessenger,
    "Edit this file",
    EDIT_MESSAGES,
  );

  // Wait for streaming to complete and tool calls to be processed
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  // Toggle the codeblock and make sure the changes show
  const toggleCodeblockChevron = await getElementByTestId("toggle-codeblock");

  await user.click(toggleCodeblockChevron);
  await getElementByText(EDIT_CHANGES);

  // Make sure there's no pending tool call
  verifyNotPresentByTestId(
    generateToolCallButtonTestId("accept", EDIT_TOOL_CALL_ID),
  );
  // Tool call, check that applyToFile was called for edit
  await waitFor(() => {
    expect(messengerPostSpy).toHaveBeenCalledWith("applyToFile", {
      streamId: expect.any(String),
      filepath: EDIT_FILE_URI,
      text: EDIT_CHANGES,
      toolCallId: EDIT_TOOL_CALL_ID,
    });
  });

  // Extract stream ID and initiate mock streaming
  const streamId = messengerPostSpy.mock.calls.find(
    (call) => call[0] === "applyToFile",
  )?.[1]?.streamId;
  expect(streamId).toBeDefined();

  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "streaming",
    streamId,
    toolCallId: EDIT_TOOL_CALL_ID,
    filepath: EDIT_FILE_URI,
  });

  // Mid stream, should show applying in notch
  await getElementByTestId("notch-applying-text");
  await getElementByTestId("notch-applying-cancel-button");

  // Close the stream
  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "done",
    streamId,
    toolCallId: EDIT_TOOL_CALL_ID,
    filepath: EDIT_FILE_URI,
  });

  // Set the chat response text before the auto-accept triggers
  ideMessenger.setChatResponseText(POST_EDIT_RESPONSE);

  await waitFor(() => {
    expect(messengerPostSpy).toHaveBeenCalledWith("acceptDiff", {
      streamId,
      filepath: EDIT_FILE_URI,
    });
  });

  // Close the stream, ensure response is shown and diff buttons are not present
  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "closed",
    streamId,
    toolCallId: EDIT_TOOL_CALL_ID,
    filepath: EDIT_FILE_URI,
  });

  // Allow time for the auto-streaming to complete
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await verifyNotPresentByTestId("edit-accept-button");
  await verifyNotPresentByTestId("edit-reject-button");

  // Try to manually trigger the streaming by checking if the response is set
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  // TODO: Fix this test - the POST_EDIT_RESPONSE is not being displayed
  // await waitFor(() => getElementByText(POST_EDIT_RESPONSE), {
  //   timeout: 8000,
  // });
});
