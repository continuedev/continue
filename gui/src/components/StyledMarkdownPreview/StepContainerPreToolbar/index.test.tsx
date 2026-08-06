import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepContainerPreToolbar } from "./index";

vi.mock("../../../context/IdeMessenger", () => {
  const { createContext } = require("react");
  return {
    IdeMessengerContext: createContext({
      ide: {
        getCurrentFile: vi.fn().mockResolvedValue(undefined),
        showToast: vi.fn(),
        showLines: vi.fn(),
      },
      post: vi.fn(),
    }),
  };
});

vi.mock("../../../redux/hooks", () => ({
  useAppSelector: () => ({}),
}));

vi.mock("../../../hooks/useWebviewListener", () => ({
  useWebviewListener: () => {},
}));

vi.mock("../../../hooks/useIdeMessengerRequest", () => ({
  useIdeMessengerRequest: () => ({
    result: undefined,
    refresh: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("../../../redux/selectors/selectToolCalls", () => ({
  selectToolCallById: () => undefined,
}));

vi.mock("../../../redux/slices/sessionSlice", () => ({
  selectApplyStateByStreamId: () => undefined,
  selectApplyStateByToolCallId: () => undefined,
}));

describe("StepContainerPreToolbar", () => {
  const baseProps = {
    codeBlockContent: "console.log('hello')",
    language: "javascript",
    codeBlockIndex: 0,
    isLastCodeblock: true,
    codeBlockStreamId: "stream-1",
  };

  it("renders the code block", () => {
    const { container } = render(
      <StepContainerPreToolbar {...baseProps}>
        <pre>console.log(&#39;hello&#39;)</pre>
      </StepContainerPreToolbar>,
    );
    expect(container).toBeTruthy();
  });

  it("lets the title side shrink and pins the action buttons so the toolbar never overflows the panel", () => {
    const { container } = render(
      <StepContainerPreToolbar {...baseProps}>
        <pre>console.log(&#39;hello&#39;)</pre>
      </StepContainerPreToolbar>,
    );

    const titleContainer = [...container.querySelectorAll("div")].find((el) =>
      el.classList.contains("min-w-0"),
    );
    expect(titleContainer).toBeTruthy();

    const actionsContainer = [...container.querySelectorAll("div")].find((el) =>
      el.classList.contains("shrink-0"),
    );
    expect(actionsContainer).toBeTruthy();
  });
});
