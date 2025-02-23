import { screen } from "@testing-library/dom";
import { renderWithProviders } from "../../util/test/render";
import HistoryPage from "./index";

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
    expect(
      screen.getByText("All session data is saved in ~/.continue/sessions"),
    ).toBeInTheDocument();
  });
});
