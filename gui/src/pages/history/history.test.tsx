import HistoryPage from "./index";
import { renderWithProviders } from "../../util/test/render";
import { screen } from "@testing-library/dom";

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
    expect(screen.getByText("History")).toBeInTheDocument();
  });
});
