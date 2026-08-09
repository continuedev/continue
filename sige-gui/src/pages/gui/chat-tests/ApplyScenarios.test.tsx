import { act } from "@testing-library/react";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  verifyNotPresentByTestId,
  verifyNotPresentByText,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

test("Chat apply scenarios: handle apply updates and display the accept / reject all buttons", async () => {
  const { ideMessenger } = await renderWithProviders(<Chat />);

  // Use queryByText which returns null when element isn't found
  await verifyNotPresentByText("Accept All");
  await verifyNotPresentByText("Reject All");

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
  await getElementByTestId("accept-reject-all-buttons");

  // IDE sends back message that it is done
  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "closed",
    streamId: "12345",
  });

  // Wait for the buttons to disappear
  await verifyNotPresentByTestId("edit-accept-button");
  await verifyNotPresentByTestId("edit-reject-button");
});

test("Chat apply scenarios: show apply cancellation", async () => {
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
  await getElementByTestId("notch-applying-text");

  await act(async () => {
    const cancelApplyButton = await getElementByTestId(
      "notch-applying-cancel-button",
    );
    cancelApplyButton.click();
  });

  // Verify that rejectDiff message has been posted to ideMessenger
  expect(messengerPostSpy).toHaveBeenCalledWith("rejectDiff", {});

  // Now simulate the IDE sending back a message that the apply state is closed
  ideMessenger.mockMessageToWebview("updateApplyState", {
    status: "closed",
    streamId: "12345",
  });

  await verifyNotPresentByTestId("notch-applying-text");
  await verifyNotPresentByTestId("notch-applying-cancel-button");

  // Cleanup spy
  messengerPostSpy.mockRestore();
});
