import { act } from "@testing-library/react";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  getElementByText,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

test("should render input box", async () => {
  await renderWithProviders(<Chat />);
  await getElementByTestId("continue-input-box");
});

test("should be able to toggle modes", async () => {
  await renderWithProviders(<Chat />);
  await getElementByText("Chat");

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
  await getElementByText("Agent");

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: ".",
        metaKey: true, // cmd key on Mac
      }),
    );
  });

  await getElementByText("Chat");
});

test("should send a message and receive a response", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  // First add and select the mock LLM
  await act(async () => {
    addAndSelectMockLlm(store, ideMessenger);
  });

  const CONTENT = "Expected response";
  const INPUT = "User input";

  await sendInputWithMockedResponse(ideMessenger, INPUT, [
    { role: "assistant", content: CONTENT },
  ]);

  await getElementByText(CONTENT);
});
