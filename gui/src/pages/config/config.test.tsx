import { screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
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
    expect(screen.getAllByText("Tools & MCPs").length).toBeGreaterThan(0);
    expect(screen.getByText("Conversation")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search settings"), "mcp");

    expect(
      screen.getByTestId("config-search-target-tools-tab"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Rules & Prompts")).not.toBeInTheDocument();
  });

  it("jumps to a subsection search target across tabs", async () => {
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    const { user } = await renderWithProviders(<ConfigPage />, {
      routerProps: {
        initialEntries: ["/config?tab=models"],
      },
    });

    await user.type(
      screen.getByPlaceholderText("Search settings"),
      "telemetry",
    );
    await user.click(
      screen.getByTestId("config-search-target-settings-privacy-telemetry"),
    );

    expect(await screen.findByText("Privacy & Telemetry")).toBeInTheDocument();
    expect(
      screen.getByTestId("config-anchor-privacy-telemetry"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});
