import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ArgsToggleIcon } from "./ToolCallArgs";

function ArgsToggleHarness() {
  const [isShowing, setIsShowing] = useState(false);

  return <ArgsToggleIcon isShowing={isShowing} setIsShowing={setIsShowing} />;
}

describe("ArgsToggleIcon", () => {
  it("uses an accessible label that follows the current state", async () => {
    const user = userEvent.setup();

    render(<ArgsToggleHarness />);

    const button = screen.getByRole("button", { name: "Show args" });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(
      screen.getByRole("button", { name: "Hide args" }),
    ).toBeInTheDocument();
  });
});
