import { screen, waitFor } from "@testing-library/dom";
import { act } from "@testing-library/react";
import { renderWithProviders } from "../../util/test/render";
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

  it("should handle apply updates and display the accept / reject all buttons", async () => {
    const { ideMessenger } = await renderWithProviders(<Chat />);

    // Use queryByText which returns null when element isn't found
    const acceptAllButton = screen.queryByText("Accept All");
    const rejectAllButton = screen.queryByText("Reject All");

    // Assert that the buttons don't exist
    expect(acceptAllButton).not.toBeInTheDocument();
    expect(rejectAllButton).not.toBeInTheDocument();

    for (let i = 0; i < 5; i++) {
      ideMessenger.mockMessageToWebview("updateApplyState", {
        status: "streaming",
        streamId: `12345`,
      });
    }

    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "done",
      streamId: "12345",
    });

    // Wait for the buttons to appear
    await waitFor(() => {
      expect(
        screen.getByTestId("accept-reject-all-buttons"),
      ).toBeInTheDocument();
    });

    // IDE sends back message that it is done
    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "closed",
      streamId: "12345",
    });

    // Wait for the buttons to disappear
    await waitFor(() => {
      expect(
        screen.queryByTestId("edit-accept-button"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("edit-reject-button"),
      ).not.toBeInTheDocument();
    });
  });

  it("should show apply cancellation", async () => {
    const { ideMessenger } = await renderWithProviders(<Chat />);

    // Spy on the request method of ideMessenger
    const messengerPostSpy = vi.spyOn(ideMessenger, "post");

    for (let i = 0; i < 5; i++) {
      ideMessenger.mockMessageToWebview("updateApplyState", {
        status: "streaming",
        streamId: `12345`,
      });
    }

    // Wait for applying toolbar to appear
    await waitFor(() => {
      const cancelApplyButton = screen.getByTestId(
        "notch-applying-cancel-button",
      );
      const applyingText = screen.getByTestId("notch-applying-text");

      expect(cancelApplyButton).toBeInTheDocument();
      expect(applyingText).toBeInTheDocument();
    });

    const cancelApplyButton = screen.getByTestId(
      "notch-applying-cancel-button",
    );
    cancelApplyButton.click();

    // Verify that rejectDiff message has been posted to ideMessenger
    expect(messengerPostSpy).toHaveBeenCalledWith("rejectDiff", {});

    // Now simulate the IDE sending back a message that the apply state is closed
    ideMessenger.mockMessageToWebview("updateApplyState", {
      status: "closed",
      streamId: "12345",
    });

    await waitFor(() => {
      const cancelApplyButton = screen.queryByTestId(
        "notch-applying-cancel-button",
      );
      const applyingText = screen.queryByTestId("notch-applying-text");

      expect(cancelApplyButton).not.toBeInTheDocument();
      expect(applyingText).not.toBeInTheDocument();
    });

    // Cleanup spy
    messengerPostSpy.mockRestore();
  });
});
