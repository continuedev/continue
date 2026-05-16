import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WorkingGroupBox } from "./WorkingGroupBox";

describe("WorkingGroupBox", () => {
  it("shows collapsed summary text when the group is collapsed", async () => {
    const user = userEvent.setup();

    render(
      <WorkingGroupBox
        isActive={false}
        actionCount={6}
        collapsedSummary="continue"
      >
        <div>tool call body</div>
      </WorkingGroupBox>,
    );

    const header = screen.getByRole("button");

    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByTestId("working-group-box-chevron-down"),
    ).toBeInTheDocument();

    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("6 actions · continue")).toBeInTheDocument();
    expect(
      screen.getByTestId("working-group-box-chevron-right"),
    ).toBeInTheDocument();
  });

  it("uses down chevron when expanded and right chevron when collapsed", async () => {
    const user = userEvent.setup();

    render(
      <WorkingGroupBox isActive={false} actionCount={1}>
        <div>tool call body</div>
      </WorkingGroupBox>,
    );

    const header = screen.getByRole("button");

    expect(
      screen.getByTestId("working-group-box-chevron-down"),
    ).toBeInTheDocument();

    await user.click(header);
    expect(
      screen.getByTestId("working-group-box-chevron-right"),
    ).toBeInTheDocument();

    await user.click(header);
    expect(
      screen.getByTestId("working-group-box-chevron-down"),
    ).toBeInTheDocument();
  });

  it("renders a visible connector between multiple timeline items", () => {
    render(
      <WorkingGroupBox isActive={false} actionCount={2}>
        <div>first tool call</div>
        <div>second tool call</div>
      </WorkingGroupBox>,
    );

    expect(
      screen.getAllByTestId("working-group-box-timeline-connector").length,
    ).toBeGreaterThan(0);
  });
});
