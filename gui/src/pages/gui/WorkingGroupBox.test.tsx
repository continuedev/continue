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

  it("does not render timeline rail visuals between action rows", () => {
    render(
      <WorkingGroupBox isActive={false} actionCount={2}>
        <div>first tool call</div>
        <div>second tool call</div>
      </WorkingGroupBox>,
    );

    expect(
      screen.queryByTestId("working-group-box-timeline-rail"),
    ).not.toBeInTheDocument();
  });

  it("also omits timeline rail visuals for a single action row", () => {
    render(
      <WorkingGroupBox isActive={false} actionCount={1}>
        <div>single tool call</div>
      </WorkingGroupBox>,
    );

    expect(
      screen.queryByTestId("working-group-box-timeline-rail"),
    ).not.toBeInTheDocument();
  });
});
