import { act } from "@testing-library/react";
import { renderWithProviders } from "../util/test/render";
import { getElementByText } from "../util/test/utils";
import Layout from "./Layout";

test("renders bridge permission dialogs in the webview and responds with the selected action", async () => {
  const { ideMessenger, user } = await renderWithProviders(<Layout />);
  const respondSpy = vi.spyOn(ideMessenger, "respond");

  await act(async () => {
    ideMessenger.mockMessageToWebview("vscode/showBridgeDialog", {
      id: "request-1",
      kind: "warning",
      title: "Permission required: Bash",
      message: "Allow background agent tool call: Bash?",
      options: [
        { title: "Allow", value: "approve" },
        { title: "Deny", value: "deny" },
      ],
    });
  });

  await getElementByText("Permission required: Bash");
  await user.click(await getElementByText("Allow"));

  expect(respondSpy).toHaveBeenCalledWith(
    "vscode/showBridgeDialog",
    {
      id: "request-1",
      confirmed: true,
      value: "approve",
    },
    expect.any(String),
  );
});
