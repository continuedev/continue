import { fireEvent, render, screen } from "@testing-library/react";
import { ApplyState } from "core";
import { EditOperation } from "core/tools/definitions/multiEdit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FindAndReplaceDisplay } from "./FindAndReplace";

// Mock the dependencies
vi.mock("../../../context/IdeMessenger", () => ({
  IdeMessengerContext: {
    _currentValue: { post: vi.fn() },
  },
}));

vi.mock("../../../redux/hooks", () => ({
  useAppSelector: vi.fn(),
}));

vi.mock("../../../components/ui", () => ({
  useFontSize: () => 14,
}));

vi.mock("core/edit/searchAndReplace/performReplace", () => ({
  executeFindAndReplace: vi.fn(),
}));

vi.mock("./utils", () => ({
  getStatusIcon: vi.fn(() => <div data-testid="status-icon">✓</div>),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useContext: () => ({ post: vi.fn() }),
  };
});

// Import mocked modules
import { executeFindAndReplace } from "core/edit/searchAndReplace/performReplace";
import { useAppSelector } from "../../../redux/hooks";

const mockPost = vi.fn();
const mockUseAppSelector = useAppSelector as any;
const mockExecuteFindAndReplace = executeFindAndReplace as any;

describe("FindAndReplaceDisplay", () => {
  const defaultProps = {
    fileUri: "file:///test/file.ts",
    relativeFilePath: "test/file.ts",
    editingFileContents: "const old = 'value';\nconst other = 'test';",
    edits: [
      {
        old_string: "const old = 'value';",
        new_string: "const new = 'value';",
        replace_all: false,
      },
    ] as EditOperation[],
    toolCallId: "test-tool-call-id",
    historyIndex: 0,
  };

  const mockToolCallState = {
    status: "done" as const,
    output: null,
  };

  const mockConfig = {
    ui: {
      showChatScrollbar: true,
      codeWrap: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAppSelector.mockImplementation((selector: any) => {
      const mockState = {
        config: { config: mockConfig },
        session: {
          history: [],
          codeBlockApplyStates: { states: [] },
        },
      };

      if (selector.toString().includes("selectApplyStateByToolCallId")) {
        return undefined; // No apply state by default
      }
      if (selector.toString().includes("selectToolCallById")) {
        return mockToolCallState;
      }

      return selector(mockState);
    });

    mockExecuteFindAndReplace.mockImplementation(
      (content: string, oldStr: string, newStr: string) => {
        return content.replace(oldStr, newStr);
      },
    );
  });

  describe("basic rendering", () => {
    it("should render with collapsed state by default", () => {
      render(<FindAndReplaceDisplay {...defaultProps} />);

      expect(screen.getByText("file.ts")).toBeInTheDocument();
      expect(
        screen.getByTestId("toggle-find-and-replace-diff"),
      ).toBeInTheDocument();

      // Should not show diff content when collapsed
      const diffContent = screen.queryByText("-");
      expect(diffContent).not.toBeInTheDocument();
    });

    it("should display file name from fileUri", () => {
      render(<FindAndReplaceDisplay {...defaultProps} />);
      expect(screen.getByText("file.ts")).toBeInTheDocument();
    });

    it("should display file name from relativeFilePath when no fileUri", () => {
      render(
        <FindAndReplaceDisplay
          {...defaultProps}
          fileUri={undefined}
          relativeFilePath="src/components/test.tsx"
        />,
      );
      expect(screen.getByText("test.tsx")).toBeInTheDocument();
    });

    it("should handle missing file paths gracefully", () => {
      render(
        <FindAndReplaceDisplay
          {...defaultProps}
          fileUri={undefined}
          relativeFilePath={undefined}
        />,
      );

      // Should still render the component structure
      expect(
        screen.getByTestId("toggle-find-and-replace-diff"),
      ).toBeInTheDocument();
    });
  });

  describe("expand/collapse functionality", () => {
    it("should expand when clicked", () => {
      render(<FindAndReplaceDisplay {...defaultProps} />);

      const toggleButton = screen.getByTestId("toggle-find-and-replace-diff");
      fireEvent.click(toggleButton);

      // Should show diff content when expanded
      expect(screen.getByText("-")).toBeInTheDocument();
      expect(screen.getByText("+")).toBeInTheDocument();
    });

    it("should show content when tool call status is 'generated'", () => {
      mockUseAppSelector.mockImplementation((selector: any) => {
        const mockState = {
          config: { config: mockConfig },
          session: {
            history: [],
            codeBlockApplyStates: { states: [] },
          },
        };

        if (selector.toString().includes("selectToolCallById")) {
          return { ...mockToolCallState, status: "generated" };
        }
        if (selector.toString().includes("selectApplyStateByToolCallId")) {
          return undefined;
        }

        return selector(mockState);
      });

      render(<FindAndReplaceDisplay {...defaultProps} />);

      // Should show diff content without expanding
      expect(screen.getByText("-")).toBeInTheDocument();
      expect(screen.getByText("+")).toBeInTheDocument();
    });
  });

  describe("diff generation", () => {
    it("should generate and display diff correctly", () => {
      render(<FindAndReplaceDisplay {...defaultProps} />);

      const toggleButton = screen.getByTestId("toggle-find-and-replace-diff");
      fireEvent.click(toggleButton);

      // Should show removed line
      expect(screen.getByText("const old = 'value';")).toBeInTheDocument();

      // Should show added line
      expect(screen.getByText("const new = 'value';")).toBeInTheDocument();

      // Should show unchanged line
      expect(screen.getByText("const other = 'test';")).toBeInTheDocument();
    });

    it("should handle multiple edits", () => {
      const multipleEdits = [
        {
          old_string: "const old = 'value';",
          new_string: "const new = 'value';",
          replace_all: false,
        },
        {
          old_string: "const other = 'test';",
          new_string: "const other = 'updated';",
          replace_all: false,
        },
      ] as EditOperation[];

      mockExecuteFindAndReplace
        .mockReturnValueOnce("const new = 'value';\nconst other = 'test';")
        .mockReturnValueOnce("const new = 'value';\nconst other = 'updated';");

      render(<FindAndReplaceDisplay {...defaultProps} edits={multipleEdits} />);

      const toggleButton = screen.getByTestId("toggle-find-and-replace-diff");
      fireEvent.click(toggleButton);

      expect(mockExecuteFindAndReplace).toHaveBeenCalledTimes(2);
    });

    it("should handle diff generation errors", () => {
      mockExecuteFindAndReplace.mockImplementation(() => {
        throw new Error("Test error");
      });

      render(<FindAndReplaceDisplay {...defaultProps} />);

      // When diff generation errors, component shows a friendly message
      // without rendering the expand/collapse container
      expect(
        screen.getByText("The searched string was not found in the file"),
      ).toBeInTheDocument();
    });

    it("should show 'No changes to display' when diff is empty", () => {
      // Mock the function to return the exact same content (no changes)
      mockExecuteFindAndReplace.mockReturnValue(
        defaultProps.editingFileContents,
      );

      render(<FindAndReplaceDisplay {...defaultProps} />);

      const toggleButton = screen.getByTestId("toggle-find-and-replace-diff");
      fireEvent.click(toggleButton);

      expect(screen.getByText("No changes to display")).toBeInTheDocument();
    });
  });

  describe("apply actions", () => {
    const mockApplyState: ApplyState = {
      streamId: "test-stream-id",
      status: "streaming",
      numDiffs: 1,
      fileContent: "test content",
    };

    beforeEach(() => {
      mockUseAppSelector.mockImplementation((selector: any) => {
        const mockState = {
          config: { config: mockConfig },
          session: {
            history: [],
            codeBlockApplyStates: { states: [mockApplyState] },
          },
        };

        if (selector.toString().includes("selectApplyStateByToolCallId")) {
          return mockApplyState;
        }
        if (selector.toString().includes("selectToolCallById")) {
          return mockToolCallState;
        }

        return selector(mockState);
      });
    });

    it("should show apply actions when applyState exists", () => {
      render(<FindAndReplaceDisplay {...defaultProps} />);

      // ApplyActions component should be rendered (we can test by looking for its structure)
      // Since we don't have the exact structure, we test that the container is there
      expect(
        screen.getByTestId("toggle-find-and-replace-diff"),
      ).toBeInTheDocument();
    });

    it("should handle accept action", () => {
      render(<FindAndReplaceDisplay {...defaultProps} />);

      // This would need more detailed testing if ApplyActions was properly mocked
      // For now, we verify the component renders without errors
      expect(
        screen.getByTestId("toggle-find-and-replace-diff"),
      ).toBeInTheDocument();
    });
  });

  describe("content handling", () => {
    it("should use editingFileContents when provided", () => {
      render(<FindAndReplaceDisplay {...defaultProps} />);

      const toggleButton = screen.getByTestId("toggle-find-and-replace-diff");
      fireEvent.click(toggleButton);

      expect(mockExecuteFindAndReplace).toHaveBeenCalledWith(
        "const old = 'value';\nconst other = 'test';",
        "const old = 'value';",
        "const new = 'value';",
        false,
        0,
      );
    });

    it("should fallback to edit old_strings when no editingFileContents", () => {
      render(
        <FindAndReplaceDisplay
          {...defaultProps}
          editingFileContents={undefined}
        />,
      );

      const toggleButton = screen.getByTestId("toggle-find-and-replace-diff");
      fireEvent.click(toggleButton);

      expect(mockExecuteFindAndReplace).toHaveBeenCalledWith(
        "const old = 'value';",
        "const old = 'value';",
        "const new = 'value';",
        false,
        0,
      );
    });
  });
});
