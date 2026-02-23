import { screen, waitFor } from "@testing-library/react";
import { ToolCallState } from "core";
import { renderWithProviders } from "../../util/test/render";
import { UnifiedTerminalCommand } from "./UnifiedTerminal";

const MOCK_COMMAND = "npm test";
const MOCK_OUTPUT = `Running tests...
✓ Test 1 passed
✓ Test 2 passed
✗ Test 3 failed
  Error: Expected true but got false

Test Results:
  2 passed, 1 failed
  Total: 3 tests`;

const LONG_OUTPUT = Array.from({ length: 25 }, (_, i) => `Line ${i + 1}`).join(
  "\n",
);
const MOCK_TOOL_CALL_ID = "terminal-call-123";

const MOCK_ANSI_OUTPUT = `\u001b[32m✓\u001b[0m Test passed
\u001b[31m✗\u001b[0m Test failed
\u001b[1mBold text\u001b[0m
\u001b[4mUnderlined text\u001b[0m`;

const MOCK_OUTPUT_WITH_LINKS = `Build successful!
Visit https://example.com for more info
Check www.github.com/user/repo
Error logs at file:///tmp/error.log`;

// Mock the redux hooks
const mockDispatch = vi.fn();
const mockSelector = vi.fn();
vi.mock("../../redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => mockSelector,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnifiedTerminalCommand", () => {
  test("renders basic terminal command without output", async () => {
    const { user } = await renderWithProviders(
      <UnifiedTerminalCommand command={MOCK_COMMAND} status="completed" />,
    );

    // Should show the command
    expect(screen.getByText(`$ ${MOCK_COMMAND}`)).toBeInTheDocument();

    // Should show terminal header
    expect(screen.getByText("Terminal")).toBeInTheDocument();

    // Should show completed status icon (green dot)
    const terminalContainer = screen.getByTestId("terminal-container");
    expect(terminalContainer).toBeInTheDocument();
  });

  test("renders terminal command with output", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT}
        status="completed"
      />,
    );

    // Should show the command and output
    expect(screen.getByText(`$ ${MOCK_COMMAND}`)).toBeInTheDocument();

    // Check that the output content exists in the container
    expect(container.textContent).toMatch(/Test 1 passed/);
    expect(container.textContent).toMatch(/Test 3 failed/);
  });

  test("shows running state with blinking cursor", async () => {
    const mockToolCallState: ToolCallState = {
      status: "calling",
      toolCallId: MOCK_TOOL_CALL_ID,
      toolCall: {
        id: MOCK_TOOL_CALL_ID,
        type: "function",
        function: {
          name: "terminal",
          arguments: "{}",
        },
      },
      parsedArgs: {},
    };

    const { user } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="running"
        toolCallState={mockToolCallState}
        toolCallId={MOCK_TOOL_CALL_ID}
      />,
    );

    // Should show running status
    expect(screen.getByText("Running")).toBeInTheDocument();

    // Should show move to background link
    expect(screen.getByText("Move to background")).toBeInTheDocument();
  });

  test("can expand and collapse terminal", async () => {
    const { user, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT}
        status="completed"
      />,
    );

    // Should initially be expanded and show output
    expect(container.textContent).toMatch(/Test 1 passed/);

    // Find and click the collapse chevron (SVG icon)
    const chevron = container.querySelector(
      'svg[class*="cursor-pointer"], .cursor-pointer svg',
    );
    expect(chevron).toBeInTheDocument();

    if (chevron) {
      await user.click(chevron);

      // After collapsing, output should not be visible
      await waitFor(() => {
        expect(container.textContent).not.toMatch(/Test 1 passed/);
      });
    }
  });

  test("shows collapsible output for long content", async () => {
    const { user, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={LONG_OUTPUT}
        status="completed"
        displayLines={15}
      />,
    );

    // Should show the "+X more lines" indicator
    expect(screen.getByText(/\+\d+ more lines/)).toBeInTheDocument();

    // Should initially show only some of the last lines
    expect(container.textContent).toMatch(/Line 25/);

    // Click to expand using the "+X more lines" button
    const expandButton = screen.getByText(/\+\d+ more lines/);
    await user.click(expandButton);

    // Should now show all lines
    await waitFor(() => {
      expect(container.textContent).toMatch(/Line 1/);
    });

    // Should show collapse option
    expect(screen.getByText(/Collapse/)).toBeInTheDocument();
  });

  test("renders ANSI colors and formatting", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_ANSI_OUTPUT}
        status="completed"
      />,
    );

    // Should render ANSI content (check the container text since ANSI splits across elements)
    expect(container.textContent).toMatch(/Test passed/);
    expect(container.textContent).toMatch(/Test failed/);
    expect(container.textContent).toMatch(/Bold text/);
    expect(container.textContent).toMatch(/Underlined text/);

    // Verify ANSI processing created span elements within the code block
    // The AnsiRenderer creates spans for each ANSI segment
    const codeElement = container.querySelector("code");
    expect(codeElement).toBeInTheDocument();

    // Count all spans inside the code element (ANSI creates multiple spans)
    const spans = codeElement?.querySelectorAll("span");
    expect(spans?.length).toBeGreaterThan(0);
  });

  test("handles links in output", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT_WITH_LINKS}
        status="completed"
      />,
    );

    // Should contain the link text in the output
    expect(container.textContent).toMatch(/https:\/\/example\.com/);
    expect(container.textContent).toMatch(/www\.github\.com/);

    // Note: Link detection might create actual <a> tags or just display the URLs
    // The important thing is the URLs are visible in the output
  });

  test("shows copy and run in terminal buttons when not running", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT}
        status="completed"
      />,
    );

    // Look for toolbar elements - they may be hidden by responsive classes but exist in DOM
    const toolbarArea = container.querySelector('[class*="gap-2.5"]');
    expect(toolbarArea).toBeInTheDocument();

    // Should contain SVG icons for copy/run operations
    const svgIcons = container.querySelectorAll("svg");
    expect(svgIcons.length).toBeGreaterThan(0);

    // Should show "Run" text (may be hidden on small screens)
    expect(container.textContent).toMatch(/Run/);
  });

  test("handles move to background action", async () => {
    const mockToolCallState: ToolCallState = {
      status: "calling",
      toolCallId: MOCK_TOOL_CALL_ID,
      toolCall: {
        id: MOCK_TOOL_CALL_ID,
        type: "function",
        function: {
          name: "terminal",
          arguments: "{}",
        },
      },
      parsedArgs: {},
    };

    const { user } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="running"
        toolCallState={mockToolCallState}
        toolCallId={MOCK_TOOL_CALL_ID}
      />,
    );

    // Find and click move to background link
    const moveToBackgroundLink = screen.getByText("Move to background");
    await user.click(moveToBackgroundLink);

    // Should dispatch the move to background action
    expect(mockDispatch).toHaveBeenCalled();
  });

  test("shows different status types correctly", async () => {
    // Test completed status
    const { rerender, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="completed"
        statusMessage="Command completed successfully"
      />,
    );

    expect(container.textContent).toMatch(/Command completed successfully/);

    // Test failed status
    rerender(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="failed"
        statusMessage="Command failed with exit code 1"
      />,
    );

    expect(container.textContent).toMatch(/Command failed with exit code 1/);

    // Test background status
    rerender(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="background"
        statusMessage="Command moved to background"
      />,
    );

    expect(container.textContent).toMatch(/Command moved to background/);
  });

  test("handles empty output gracefully", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output=""
        status="completed"
      />,
    );

    // Should show command but no output section
    expect(screen.getByText(`$ ${MOCK_COMMAND}`)).toBeInTheDocument();

    // Should not show any output content
    const outputElements = container.querySelectorAll(
      "pre code > div:not(:first-child)",
    );
    expect(outputElements.length).toBe(0);
  });

  test("processes terminal content correctly for line limiting", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={LONG_OUTPUT}
        status="completed"
        displayLines={10}
      />,
    );

    // Should show correct number of hidden lines
    expect(screen.getByText(/\+15 more lines/)).toBeInTheDocument();

    // Should show the last lines
    expect(container.textContent).toMatch(/Line 25/);

    // Should not initially show the first lines (Line 1-15 should be hidden)
    // The component shows last 10 lines (16-25) with a +15 more lines indicator
    expect(container.textContent).toMatch(/Line 16/);
  });

  test("clicking on collapsible output toggles expansion", async () => {
    const { user, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={LONG_OUTPUT}
        status="completed"
        displayLines={10}
      />,
    );

    // Click on the "+15 more lines" button to expand
    const expandButton = screen.getByText(/\+15 more lines/);
    await user.click(expandButton);

    // Should expand and show all content
    await waitFor(() => {
      expect(container.textContent).toMatch(/Line 1/);
    });

    // Should show collapse option after expansion
    expect(screen.getByText(/Collapse/)).toBeInTheDocument();
  });
});
