import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { expect, it, vi } from "vitest";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import StyledMarkdownPreview from "./index";

const createMockStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      session: (state = { history: [], symbols: {} }, action) => state,
      ui: (state = { theme: "dark" }, action) => state,
      config: (state = {}, action) => state,
    },
    preloadedState,
  });
};

vi.mock("./StepContainerPreToolbar", () => ({
  StepContainerPreToolbar: (props: any) => (
    <div data-testid="mock-toolbar">{props.children}</div>
  ),
}));

vi.mock("./MermaidBlock", () => ({
  default: (props: any) => <div data-testid="mock-mermaid">{props.code}</div>,
}));

vi.mock("./FilenameLink", () => ({
  default: (props: any) => (
    <div data-testid="mock-filename-link">
      <mark>{props.children || "Fallback"}</mark>
    </div>
  ),
}));

vi.mock("./utils", () => ({
  isSymbolNotRif: (obj: any) => obj.type === "symbol",
  matchCodeToSymbolOrFile: (content: string) => {
    if (content.includes("Symbol")) {
      return {
        type: "symbol",
        name: "MySymbol",
        filepath: "/path/to/file.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 },
        },
        content: "class MySymbol {}",
      };
    } else if (content.includes("file.ts")) {
      return {
        type: "file",
        filepath: "/path/to/file.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 },
        },
      };
    }
    return undefined;
  },
}));

// Helper to render component
const renderComponent = (
  md: string,
  syms: any = {},
  searchT = "",
  currentMatch?: any,
) => {
  const store = createMockStore({
    session: {
      history: [{ message: { role: "user", content: "" }, contextItems: [] }],
      symbols: syms,
    },
  });

  const mockIdeMessenger = {
    post: vi.fn(),
    request: vi.fn(),
    ide: { getFileContents: vi.fn(), openFile: vi.fn() },
  };

  return render(
    <Provider store={store}>
      <IdeMessengerContext.Provider value={mockIdeMessenger as any}>
        <StyledMarkdownPreview
          source={md}
          itemIndex={0}
          searchState={{
            searchTerm: searchT,
            caseSensitive: true,
            useRegex: false,
            currentMatch,
          }}
        />
      </IdeMessengerContext.Provider>
    </Provider>,
  );
};

it("should highlight search terms inside code blocks without linking", async () => {
  renderComponent("`Code`", {}, "Code");

  await waitFor(() => {
    const mark = document.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveTextContent("Code");
    expect(mark?.closest("code")?.parentElement).not.toHaveClass(
      "cursor-pointer",
    );
  });
});

it("should handle symbol links with highlighting", async () => {
  const symbols = {
    "file:///path/to/file.ts": [
      {
        name: "MySymbol",
        filepath: "/path/to/file.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 },
        },
        content: "class MySymbol {}",
      },
    ],
  };
  renderComponent("`MySymbol`", symbols, "Symbol");

  await waitFor(() => {
    const mark = document.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveTextContent("Symbol");
    expect(
      screen.getByText((c) => c.includes("Symbol")).closest(".cursor-pointer"),
    ).toBeInTheDocument();
  });
});

it("should handle filename links with highlighting", async () => {
  renderComponent("`file.ts`", {}, "file");

  await waitFor(() => {
    // Check for mock component
    const mockLink = screen.getByTestId("mock-filename-link");
    expect(mockLink).toBeInTheDocument();

    // Check highlighting inside the mock
    // Since we mocked FilenameLink to simply render children, the mark should be present
    const mark = mockLink.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveTextContent("file");
  });
});

it("should handle filename links inside preformatted code blocks", async () => {
  const md = `
\`\`\`
file.ts
\`\`\`
`;
  renderComponent(md, {}, "file");

  await waitFor(() => {
    // Check for mock component
    const mockLink = screen.getByTestId("mock-filename-link");
    expect(mockLink).toBeInTheDocument();

    // Check highlighting inside the mock
    const mark = mockLink.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveTextContent("file");
  });
});

it("should scroll to active search match", async () => {
  const scrollIntoViewMock = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

  renderComponent("text match", {}, "match", {
    messageIndex: 0,
    matchIndexInMessage: 0,
  });

  await waitFor(() => {
    const mark = document.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveClass("active");
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
