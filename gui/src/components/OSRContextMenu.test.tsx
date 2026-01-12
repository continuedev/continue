import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { IdeMessengerContext } from "../context/IdeMessenger";
import OSRContextMenu from "./OSRContextMenu";

// Mocking getPlatform
vi.mock("../util", () => ({
  getPlatform: () => "linux",
}));

// Mocking useIsOSREnabled
vi.mock("../hooks/useIsOSREnabled", () => ({
  default: () => true,
}));

describe("OSRContextMenu", () => {
  const mockPost = vi.fn();
  const mockRequest = vi.fn();

  const renderComponent = () => {
    return render(
      <IdeMessengerContext.Provider
        value={{ post: mockPost, request: mockRequest } as any}
      >
        <OSRContextMenu />
      </IdeMessengerContext.Provider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window/document mocks if needed
    window.getSelection = vi.fn().mockReturnValue({
      rangeCount: 0,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      getRangeAt: vi.fn(),
    });
  });

  it("should not render by default", () => {
    const { container } = renderComponent();
    expect(container.firstChild).toBeNull();
  });

  it("should open on contextmenu event (via right click mousedown) and show default items", async () => {
    renderComponent();

    // Trigger right click
    fireEvent.mouseDown(document, { clientX: 100, clientY: 100, button: 2 });

    await waitFor(() => {
      expect(screen.getByText("Select All")).toBeInTheDocument();
      expect(screen.getByText("Open Dev Tools")).toBeInTheDocument();
    });

    // Verify "Rule" items are NOT present (reversion check)
    expect(screen.queryByText("Edit Rule")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete Rule")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete Global Rule")).not.toBeInTheDocument();
  });

  it("should show Copy when text is selected", async () => {
    renderComponent();

    // Mock selection
    const mockRange = {
      toString: () => "selected text",
      cloneRange: () => ({ ...mockRange }),
      getClientRects: () => [{ left: 0, right: 200, top: 0, bottom: 200 }],
    };

    window.getSelection = vi.fn().mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => mockRange,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    });

    // Right click
    fireEvent.mouseDown(document, { clientX: 50, clientY: 50, button: 2 });

    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });
  });

  it("should show Cut/Paste/Undo/Redo when target is editable (e.g. Chat Input)", async () => {
    renderComponent();

    const input = document.createElement("input");
    document.body.appendChild(input);

    // Right click on input
    fireEvent.mouseDown(input, { clientX: 100, clientY: 100, button: 2 });

    await waitFor(() => {
      expect(screen.getByText("Paste")).toBeInTheDocument();
      expect(screen.getByText("Undo")).toBeInTheDocument();
      expect(screen.getByText("Redo")).toBeInTheDocument();
    });

    // Cut/Copy require selection
    expect(screen.queryByText("Cut")).not.toBeInTheDocument();
    expect(screen.queryByText("Copy")).not.toBeInTheDocument();

    document.body.removeChild(input);
  });

  it("should showing Copy but NOT Cut/Paste for Read Only content (e.g. Agent Reply / Code Snippet)", async () => {
    renderComponent();

    const div = document.createElement("div");
    div.innerText = "Agent Code Block";
    document.body.appendChild(div);

    // Mock selection
    const mockRange = {
      toString: () => "Code Block",
      cloneRange: () => ({ ...mockRange }),
      getClientRects: () => [{ left: 0, right: 200, top: 0, bottom: 200 }],
    };

    window.getSelection = vi.fn().mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => mockRange,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    });

    fireEvent.mouseDown(div, { clientX: 50, clientY: 50, button: 2 });

    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeInTheDocument();
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    // Verify editable actions are missing
    expect(screen.queryByText("Cut")).not.toBeInTheDocument();
    expect(screen.queryByText("Paste")).not.toBeInTheDocument();
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();

    // Verify Rule items are missing
    expect(screen.queryByText("Edit Rule")).not.toBeInTheDocument();

    document.body.removeChild(div);
  });
  it("should 'Select All' only within the code block if clicking inside a code block", async () => {
    // Mock Range and Selection
    const mockRange = {
      selectNodeContents: vi.fn(),
      toString: () => "",
      cloneRange: () => ({ ...mockRange }),
      getClientRects: () => [],
    };

    // Create dom structure: div > pre > code > text
    const container = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    const text = document.createTextNode("function test() {}");

    code.appendChild(text);
    pre.appendChild(code);
    container.appendChild(pre);
    document.body.appendChild(container);

    // Mock document.createRange to return our mock
    document.createRange = vi.fn().mockReturnValue(mockRange);

    window.getSelection = vi.fn().mockReturnValue({
      rangeCount: 0,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      getRangeAt: vi.fn(),
    });

    renderComponent();

    // Right click on the code element
    fireEvent.mouseDown(code, { clientX: 50, clientY: 50, button: 2 });

    await waitFor(() => {
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    // Click "Select All"
    fireEvent.click(screen.getByText("Select All"));

    // Verify it selected the PRE/CODE element content
    // The implementation finds PRE or CODE. Since we clicked CODE, it found CODE.
    expect(mockRange.selectNodeContents).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: "CODE" }),
    );

    document.body.removeChild(container);
  });

  it("should not open on left click", async () => {
    renderComponent();

    // Trigger left click (button 0)
    fireEvent.mouseDown(document, { clientX: 100, clientY: 100, button: 0 });

    // Wait a bit to ensure it doesn't appear
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.queryByText("Select All")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Dev Tools")).not.toBeInTheDocument();
  });
});
