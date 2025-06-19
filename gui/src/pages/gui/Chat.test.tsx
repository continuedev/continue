import { screen, waitFor } from "@testing-library/dom";
import { act } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { addAndSelectMockLlm } from "../../util/test/config";
import { renderWithProviders } from "../../util/test/render";
import { Chat } from "./Chat";

export async function getMainEditor(): Promise<Editor> {
  const editorElement = await waitFor(() =>
    screen.findByTestId("editor-input-main"),
  );
  expect(editorElement).toBeInTheDocument();
  if ("editor" in editorElement) {
    return editorElement.editor as Editor;
  } else {
    throw new Error("Main editor not found within editor container");
  }
}

test("should render input box", async () => {
  await renderWithProviders(<Chat />);
  expect(await screen.findByTestId("continue-input-box")).toBeInTheDocument();
});

test("should be able to toggle modes", async () => {
  await renderWithProviders(<Chat />);
  expect(screen.getByText("Chat")).toBeInTheDocument();

  // Simulate cmd+. keyboard shortcut to toggle modes
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: ".",
        metaKey: true, // cmd key on Mac
      }),
    );
  });

  // Check that it switched to Agent mode
  expect(await screen.findByText("Agent")).toBeInTheDocument();

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: ".",
        metaKey: true, // cmd key on Mac
      }),
    );
  });

  // Check that it switched back to Chat mode
  expect(await screen.findByText("Chat")).toBeInTheDocument();
});

test("should send a message and receive a response", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  // First add and select the mock LLM
  await act(async () => {
    addAndSelectMockLlm(store, ideMessenger);
  });

  const CONTENT = "Expected response";
  const INPUT = "User input";

  // Setup the mock response before any actions
  ideMessenger.chatResponse = [[{ role: "assistant", content: CONTENT }]];

  // Wait for the editor to be in the document
  const editor = await getMainEditor();

  // Find the submit button
  const sendButton = await waitFor(() =>
    screen.findByTestId("submit-input-button"),
  );
  expect(sendButton).toBeInTheDocument();

  // Insert content into the editor
  await act(async () => {
    editor.commands.insertContent(INPUT);
  });

  // Verify the input is in the document
  const input = await waitFor(() => screen.findByText(INPUT));
  expect(input).toBeInTheDocument();

  // Click the send button
  await act(async () => {
    sendButton.click();
  });

  // Increase the timeout for finding the response
  const response = await waitFor(() => screen.findByText(CONTENT));
  expect(response).toBeInTheDocument();
});
