import { act, screen } from "@testing-library/react";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByText,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

describe("Conversation Summary Display", () => {
  test("should display conversation summary when present in history item", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Hello", [
      { role: "assistant", content: "Hi there!" },
    ]);

    // Manually add a conversation summary to the history item
    await act(async () => {
      store.dispatch({
        type: "session/setConversationSummary",
        payload: {
          index: 1, // Assistant message index
          summary: "This is a test conversation summary about greetings.",
        },
      });
    });

    // Verify that the conversation summary is displayed
    await getElementByText("Conversation Summary");
    await getElementByText(
      "This is a test conversation summary about greetings.",
    );

    // Verify that the conversation summary is displayed
    await getElementByText("Conversation Summary");
    await getElementByText(
      "This is a test conversation summary about greetings.",
    );

    // Verify the "Previous Conversation Compacted" indicator is shown
    await getElementByText("Previous Conversation Compacted");
  });

  test("should show loading state when compaction is in progress", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Hello", [
      { role: "assistant", content: "Hi there!" },
    ]);

    // Set compaction loading state
    await act(async () => {
      store.dispatch({
        type: "session/setCompactionLoading",
        payload: { index: 1, loading: true },
      });
    });

    // Manually add a conversation summary (simulating compaction in progress)
    await act(async () => {
      store.dispatch({
        type: "session/setConversationSummary",
        payload: {
          index: 1,
          summary: "This will be replaced by loading message",
        },
      });
    });

    // Verify that the loading message is shown instead of actual summary
    await getElementByText("Generating conversation summary...");
  });

  test("should handle multiple conversation summaries correctly", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send first message
    await sendInputWithMockedResponse(ideMessenger, "First", [
      { role: "assistant", content: "First response" },
    ]);

    // Wait for UI to stabilize before sending second message
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Send second message using direct state manipulation instead of sendInputWithMockedResponse
    // to avoid issues with button availability
    await act(async () => {
      store.dispatch({
        type: "session/submitEditorAndInitAtIndex",
        payload: {
          index: 2, // Next index after first conversation
          editorState: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Second" }],
              },
            ],
          },
        },
      });

      // Add the assistant response
      store.dispatch({
        type: "session/streamUpdate",
        payload: [{ role: "assistant", content: "Second response" }],
      });
    });

    // Add conversation summaries to both assistant messages
    await act(async () => {
      store.dispatch({
        type: "session/setConversationSummary",
        payload: {
          index: 1, // First assistant message
          summary: "First conversation summary",
        },
      });
    });

    await act(async () => {
      store.dispatch({
        type: "session/setConversationSummary",
        payload: {
          index: 3, // Second assistant message
          summary: "Second conversation summary",
        },
      });
    });

    // Both summaries should be displayed
    await getElementByText("First conversation summary");
    await getElementByText("Second conversation summary");

    // Only the latest summary should show the compaction indicator
    const compactionIndicators = screen.getAllByText(
      "Previous Conversation Compacted",
    );
    expect(compactionIndicators).toHaveLength(1);
  });
});
