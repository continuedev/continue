import { renderWithProviders } from "../../util/test/render";
import { screen, waitFor } from "@testing-library/dom";
import { act, fireEvent } from "@testing-library/react";
import { Chat } from "./Chat";

describe("Chat page test", () => {
  it("should render input box", async () => {
    await renderWithProviders(<Chat />);
    expect(await screen.findByTestId("continue-input-box")).toBeInTheDocument();
  });

  it("should be able to toggle modes", async () => {
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

    // Check that it switched to Edit mode
    expect(await screen.findByText("Edit")).toBeInTheDocument();

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
  });

  it.skip("should send a message and receive a response", async () => {
    const { user, container } = await renderWithProviders(<Chat />);
    const inputBox = await waitFor(() =>
      container.querySelector(".ProseMirror")!.querySelector("p"),
    );
    expect(inputBox).toBeDefined();

    const sendButton = await screen.findByTestId("submit-input-button");

    await act(async () => {
      // Focus input box
      inputBox!.focus();

      // Type message
      await user.type(inputBox!, "Hello, world!");

      sendButton.click();
    });
    expect(await screen.findByText("Hello, world!")).toBeInTheDocument();
  });
});
