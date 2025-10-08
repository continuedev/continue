import { screen } from "@testing-library/dom";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { renderWithProviders } from "../../util/test/render";
import HistoryPage from "./index";

const mockIdeMessenger = new MockIdeMessenger();
mockIdeMessenger.responses["history/list"] = [
  {
    title: "Session 1",
    sessionId: "session-1",
    dateCreated: new Date().toString(),
    workspaceDirectory: "/tmp",
  },
  {
    title: "Remote Agent",
    sessionId: "remote-agent-123",
    dateCreated: new Date().toString(),
    workspaceDirectory: "",
    isRemote: true,
    remoteId: "agent-123",
  },
];
describe("history Page test", () => {
  it("History text is existed after render", async () => {
    await renderWithProviders(<HistoryPage />, {
      mockIdeMessenger,
    });
    expect(screen.getByTestId("history-sessions-note")).toBeInTheDocument();
  });

  it("History shows the first item in the list", async () => {
    await renderWithProviders(<HistoryPage />, {
      mockIdeMessenger,
    });
    const sessionElement = await screen.findByText(
      "Session 1",
      {},
      {
        timeout: 3000, // There is a 2000ms timeout before the first call to refreshSessionMetadata is called
      },
    );
    expect(sessionElement).toBeInTheDocument();
  });
});
