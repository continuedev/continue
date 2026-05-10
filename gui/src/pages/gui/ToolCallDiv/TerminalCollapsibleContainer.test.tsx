import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TerminalCollapsibleContainer } from "./TerminalCollapsibleContainer";

describe("TerminalCollapsibleContainer", () => {
  it("supports keyboard toggling for collapsible output", async () => {
    const user = userEvent.setup();

    render(
      <TerminalCollapsibleContainer
        collapsible
        hiddenLinesCount={4}
        collapsedContent={<div>collapsed</div>}
        expandedContent={<div>expanded</div>}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: "Expand terminal output",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("collapsed")).toBeInTheDocument();

    toggle.focus();
    await user.keyboard("{Enter}");

    expect(
      screen.getByRole("button", { name: "Collapse terminal output" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("expanded")).toBeInTheDocument();
  });
});
