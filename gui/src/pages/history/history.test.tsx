import { screen } from "@testing-library/dom";
import { renderWithProviders } from "../../util/test/render";
import HistoryPage from "./index";

describe("history Page test", () => {
  it("History text is existed after render", async () => {
    await renderWithProviders(<HistoryPage />);
    expect(screen.getByTestId("history-sessions-note")).toBeInTheDocument();
  });

  it("History shows the first item in the list", async () => {
    await renderWithProviders(<HistoryPage />);
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
