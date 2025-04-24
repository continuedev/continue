import { screen } from "@testing-library/dom";
import { renderWithProviders } from "../../util/test/render";
import HistoryPage from "./index";
import { act } from "@testing-library/react";

const navigateFn = vi.fn();

vi.mock("react-router-dom", async () => {
  const original = await vi.importActual("react-router-dom");
  return {
    ...original,
    useNavigate: () => navigateFn,
  };
});

describe("history Page test", () => {
  it("History text is existed after render", () => {
    renderWithProviders(<HistoryPage />);
    expect(screen.getByTestId("history-sessions-note")).toBeInTheDocument();
  });

  it("History shows the first item in the list", async () => {
    renderWithProviders(<HistoryPage />);
    const sessionElement = await screen.findByText(
      "Session 1",
      {},
      {
        timeout: 5000,
      },
    );
    expect(sessionElement).toBeInTheDocument();
  });
});
