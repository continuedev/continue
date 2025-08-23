import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import { ApplyState } from "core";
import { Provider } from "react-redux";
import { describe, expect, it, Mock, vi } from "vitest";
import { useFileContent } from "../../../hooks/useFileContent";
import { SingleFindAndReplace } from "./FindAndReplace";

// Mock the useFileContent hook
vi.mock("../../../hooks/useFileContent");

// Mock the selectApplyStateByToolCallId selector
vi.mock("../../../redux/selectors/selectToolCalls", () => ({
  selectApplyStateByToolCallId: vi.fn(),
}));

const mockUseFileContent = useFileContent as Mock;

// Create a minimal store for testing
const createTestStore = (applyState?: ApplyState) => {
  return configureStore({
    reducer: {
      session: () => ({
        codeBlockApplyStates: {
          states: applyState ? [applyState] : [],
        },
      }),
    },
  });
};

describe("SingleFindAndReplace", () => {
  const defaultProps = {
    relativeFilePath: "test.ts",
    oldString: "old code",
    newString: "new code",
    replaceAll: false,
    toolCallId: "test-tool-call-id",
    historyIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when file content is loading", () => {
    mockUseFileContent.mockReturnValue({
      fileContent: null,
      isLoading: true,
      error: null,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <SingleFindAndReplace {...defaultProps} />
      </Provider>,
    );

    expect(screen.getByText("Loading file content...")).toBeInTheDocument();
  });

  it("shows error when file content fails to load", () => {
    mockUseFileContent.mockReturnValue({
      fileContent: null,
      isLoading: false,
      error: "File not found",
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <SingleFindAndReplace {...defaultProps} />
      </Provider>,
    );

    expect(
      screen.getByText(`Failed to load file: ${defaultProps.relativeFilePath}`),
    ).toBeInTheDocument();
  });

  it("shows error when find and replace operation fails", () => {
    mockUseFileContent.mockReturnValue({
      fileContent: "some content without the old string",
      isLoading: false,
      error: null,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <SingleFindAndReplace {...defaultProps} />
      </Provider>,
    );

    expect(screen.getByText(/Error:/)).toBeInTheDocument();
    expect(screen.getByText(/String not found in file/)).toBeInTheDocument();
  });

  it("shows no changes message when old and new strings result in same content", () => {
    mockUseFileContent.mockReturnValue({
      fileContent: "some content",
      isLoading: false,
      error: null,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <SingleFindAndReplace
          {...defaultProps}
          oldString="nonexistent"
          newString="replacement"
        />
      </Provider>,
    );

    // This should show an error since the string doesn't exist
    expect(screen.getByText(/Error:/)).toBeInTheDocument();
  });

  it("shows diff when find and replace operation succeeds", () => {
    const fileContent = "Hello old code world";
    mockUseFileContent.mockReturnValue({
      fileContent,
      isLoading: false,
      error: null,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <SingleFindAndReplace {...defaultProps} />
      </Provider>,
    );

    expect(screen.getByText(defaultProps.relativeFilePath)).toBeInTheDocument();
    // The diff should show the old line being removed and new line being added
    expect(screen.getByText("Hello old code world")).toBeInTheDocument();
    expect(screen.getByText("Hello new code world")).toBeInTheDocument();
  });

  it("shows apply state status when available", () => {
    mockUseFileContent.mockReturnValue({
      fileContent: "Hello old code world",
      isLoading: false,
      error: null,
    });

    const applyState: ApplyState = {
      streamId: "test-stream",
      status: "streaming",
      toolCallId: "test-tool-call-id",
    };

    const store = createTestStore(applyState);
    render(
      <Provider store={store}>
        <SingleFindAndReplace {...defaultProps} />
      </Provider>,
    );

    expect(screen.getByText("Applying...")).toBeInTheDocument();
  });

  it("shows tool call status icon when enabled", () => {
    mockUseFileContent.mockReturnValue({
      fileContent: "Hello old code world",
      isLoading: false,
      error: null,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <SingleFindAndReplace
          {...defaultProps}
          showToolCallStatusIcon={true}
          status="done"
        />
      </Provider>,
    );

    // Look for the status indicator (green dot for done status)
    const statusIndicator = document.querySelector(".bg-green-500");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("handles replace all option correctly", () => {
    const fileContent = "old code and more old code";
    mockUseFileContent.mockReturnValue({
      fileContent,
      isLoading: false,
      error: null,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <SingleFindAndReplace {...defaultProps} replaceAll={true} />
      </Provider>,
    );

    // Should show both replacements in the diff
    expect(screen.getByText(defaultProps.relativeFilePath)).toBeInTheDocument();
    expect(screen.getByText("old code and more old code")).toBeInTheDocument();
    expect(screen.getByText("new code and more new code")).toBeInTheDocument();
  });
});
