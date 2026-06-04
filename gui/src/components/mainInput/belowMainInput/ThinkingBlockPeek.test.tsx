import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../util/test/render";
import ThinkingBlockPeek from "./ThinkingBlockPeek";

describe("ThinkingBlockPeek", () => {
  it("keeps thinking content in the collapsed container until expanded", async () => {
    const content = "checking custom reasoning field";
    const { container, user } = await renderWithProviders(
      <ThinkingBlockPeek content={content} index={0} prevItem={null} />,
    );

    const toggle = screen.getByTestId("thinking-block-peek");
    const contentContainer = container.querySelector(
      "#thinking-block-content-0",
    );

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("Thought");
    expect(toggle).not.toHaveTextContent(content);
    expect(contentContainer).toHaveClass("max-h-0", "opacity-0");
    expect(contentContainer).toHaveTextContent(content);

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(contentContainer).toHaveClass("max-h-[50vh]", "opacity-100");
  });
});
