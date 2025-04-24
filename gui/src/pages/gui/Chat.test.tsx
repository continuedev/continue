import { renderWithProviders } from "../../util/test/render";
import { screen } from "@testing-library/dom";
import { Chat } from "./Chat";

describe("Chat page test", () => {
  it("should render", async () => {
    await renderWithProviders(<Chat />);
    
    expect(await screen.findByTestId("continue-input-box")).toBeInTheDocument();
  });
});
