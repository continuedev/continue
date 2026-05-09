import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../util/test/render";
import ConfigPage from "./index";

describe("config settings navigation", () => {
  it("renders grouped settings sections and filters them", async () => {
    const { user } = await renderWithProviders(<ConfigPage />, {
      routerProps: {
        initialEntries: ["/config?tab=settings"],
      },
    });

    expect(screen.getByPlaceholderText("Search settings")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Tools & MCPs")).toBeInTheDocument();
    expect(screen.getByText("Conversation")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search settings"), "mcp");

    expect(screen.getByText("Tools & MCPs")).toBeInTheDocument();
    expect(screen.queryByText("Rules & Prompts")).not.toBeInTheDocument();
  });
});
