import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";

const dispatchMock = vi.fn();
const focusMock = vi.fn();

let mockState: any;

vi.mock("../../../redux/hooks", () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: any) => selector(mockState),
}));

vi.mock("../../../components/mainInput/TipTapEditor", () => ({
  useMainEditor: () => ({
    mainEditor: {
      commands: {
        focus: focusMock,
      },
    },
  }),
}));

describe("ToolTruncateHistoryIcon", () => {
  beforeEach(() => {
    dispatchMock.mockClear();
    focusMock.mockClear();

    mockState = {
      session: {
        isStreaming: false,
        history: [
          {
            message: {
              role: "user",
              content: "hello",
            },
          },
          {
            message: {
              role: "assistant",
              content: "done",
            },
          },
        ],
      },
    };
  });

  it("renders a filler for the latest non-empty message", () => {
    render(<ToolTruncateHistoryIcon historyIndex={1} />);

    expect(screen.queryByTestId("tool-truncate-history-button")).toBeNull();
  });

  it("supports keyboard activation and trims history when not streaming", async () => {
    const user = userEvent.setup();
    render(<ToolTruncateHistoryIcon historyIndex={0} />);

    const button = screen.getByTestId("tool-truncate-history-button");

    expect(button).toHaveAttribute("aria-label", "Trim chat to this message");
    button.focus();
    await user.keyboard("{Enter}");

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session/truncateHistoryToMessage",
        payload: { index: 0 },
      }),
    );
    expect(focusMock).toHaveBeenCalled();
  });

  it("disables trimming while streaming", async () => {
    const user = userEvent.setup();
    mockState.session.isStreaming = true;

    render(<ToolTruncateHistoryIcon historyIndex={0} />);

    const button = screen.getByTestId("tool-truncate-history-button");
    expect(button).toBeDisabled();

    await user.click(button);

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(focusMock).not.toHaveBeenCalled();
  });
});
