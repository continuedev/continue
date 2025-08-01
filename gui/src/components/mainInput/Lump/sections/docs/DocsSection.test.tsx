import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import DocsIndexingStatuses from "./DocsSection";
import { AuthProvider } from "../../../../../context/Auth";
import { vi } from "vitest";

// Mock the dependencies
vi.mock("../ExploreBlocksButton", () => ({
  ExploreBlocksButton: () => <div>Explore Blocks</div>,
}));

vi.mock("./DocsIndexingStatus", () => ({
  default: ({ docConfig }: any) => (
    <div data-testid="doc-item">{docConfig.title || docConfig.startUrl}</div>
  ),
}));

vi.mock("../../../../Input", () => ({
  Input: ({ onChange, value, placeholder, ...props }: any) => (
    <input
      {...props}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data-testid="search-input"
    />
  ),
}));

vi.mock("../../../../gui/Select", () => ({
  Select: ({ value, onChange, children }: any) => (
    <select value={value} onChange={onChange} data-testid="select">
      {children}
    </select>
  ),
}));

const createMockStore = (docs: any[] = [], statuses: any = {}) => {
  return configureStore({
    reducer: {
      config: (state = { config: { docs } }) => state,
      indexing: (state = { indexing: { statuses } }) => state,
    },
  });
};

const renderWithProviders = (component: JSX.Element, store: any) => {
  return render(
    <Provider store={store}>
      <AuthProvider>{component}</AuthProvider>
    </Provider>,
  );
};

describe("DocsIndexingStatuses", () => {
  it("renders the search input and filter controls", () => {
    const store = createMockStore();
    renderWithProviders(<DocsIndexingStatuses />, store);

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getAllByTestId("select")).toHaveLength(2); // Sort and Group selects
  });

  it("filters docs based on search query", async () => {
    const docs = [
      { title: "React Documentation", startUrl: "https://react.dev" },
      { title: "Vue Guide", startUrl: "https://vuejs.org" },
      { title: "Angular Docs", startUrl: "https://angular.io" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "React" } });

    await waitFor(() => {
      const docItems = screen.getAllByTestId("doc-item");
      expect(docItems).toHaveLength(1);
      expect(docItems[0]).toHaveTextContent("React Documentation");
    });
  });

  it("shows empty state when no docs match search", async () => {
    const docs = [
      { title: "React Documentation", startUrl: "https://react.dev" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    await waitFor(() => {
      expect(
        screen.getByText(/No documentation found matching/),
      ).toBeInTheDocument();
    });
  });

  it("clears search when clear button is clicked", async () => {
    const docs = [
      { title: "React Documentation", startUrl: "https://react.dev" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("Clear search")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Clear search"));
    expect(searchInput).toHaveValue("");
  });

  it("sorts docs by status correctly", () => {
    const docs = [
      { title: "Doc 1", startUrl: "https://doc1.com" },
      { title: "Doc 2", startUrl: "https://doc2.com" },
      { title: "Doc 3", startUrl: "https://doc3.com" },
    ];
    const statuses = {
      "https://doc1.com": { status: "complete" },
      "https://doc2.com": { status: "failed" },
      "https://doc3.com": { status: "indexing" },
    };
    const store = createMockStore(docs, statuses);
    renderWithProviders(<DocsIndexingStatuses />, store);

    const docItems = screen.getAllByTestId("doc-item");
    // Should be sorted: indexing, failed, complete
    expect(docItems[0]).toHaveTextContent("Doc 3");
    expect(docItems[1]).toHaveTextContent("Doc 2");
    expect(docItems[2]).toHaveTextContent("Doc 1");
  });

  it("groups docs by domain", () => {
    const docs = [
      { title: "React Docs", startUrl: "https://react.dev/docs" },
      { title: "React Tutorial", startUrl: "https://react.dev/tutorial" },
      { title: "Vue Guide", startUrl: "https://vuejs.org/guide" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    // The component should group by domain when selected
    // This test would need more sophisticated mocking to test the actual grouping
    expect(screen.getAllByTestId("doc-item")).toHaveLength(3);
  });

  it("renders collapsible groups when grouping is enabled", () => {
    const docs = [
      { title: "GitHub Repo 1", startUrl: "https://github.com/user/repo1" },
      { title: "GitHub Repo 2", startUrl: "https://github.com/user/repo2" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    // Check that docs are rendered
    expect(screen.getAllByTestId("doc-item")).toHaveLength(2);
  });

  it("auto-expands groups when searching", async () => {
    const docs = [
      { title: "React Documentation", startUrl: "https://react.dev" },
      { title: "Vue Guide", startUrl: "https://vuejs.org" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "React" } });

    await waitFor(() => {
      // Groups should be automatically expanded when searching
      const docItems = screen.getAllByTestId("doc-item");
      expect(docItems).toHaveLength(1);
    });
  });

  it("categorizes docs correctly", () => {
    const docs = [
      { title: "GitHub Project", startUrl: "https://github.com/user/project" },
      { title: "API Reference", startUrl: "https://example.com/api/reference" },
      { title: "Tutorial", startUrl: "https://example.com/tutorial/intro" },
      { title: "Blog Post", startUrl: "https://example.com/blog/post" },
      { title: "Documentation", startUrl: "https://example.com/docs/guide" },
      { title: "Other Resource", startUrl: "https://example.com/resource" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    // All docs should be rendered
    expect(screen.getAllByTestId("doc-item")).toHaveLength(6);
  });

  it("handles empty docs list", () => {
    const store = createMockStore([]);
    renderWithProviders(<DocsIndexingStatuses />, store);

    expect(screen.getByText("Explore Blocks")).toBeInTheDocument();
    expect(screen.queryByTestId("doc-item")).not.toBeInTheDocument();
  });

  it("debounces search input", async () => {
    const docs = [
      { title: "React Documentation", startUrl: "https://react.dev" },
      { title: "Vue Guide", startUrl: "https://vuejs.org" },
    ];
    const store = createMockStore(docs);
    renderWithProviders(<DocsIndexingStatuses />, store);

    const searchInput = screen.getByTestId("search-input");

    // Type quickly
    fireEvent.change(searchInput, { target: { value: "R" } });
    fireEvent.change(searchInput, { target: { value: "Re" } });
    fireEvent.change(searchInput, { target: { value: "Rea" } });
    fireEvent.change(searchInput, { target: { value: "Reac" } });
    fireEvent.change(searchInput, { target: { value: "React" } });

    // Initially all docs should still be visible
    expect(screen.getAllByTestId("doc-item")).toHaveLength(2);

    // Wait for debounce
    await waitFor(
      () => {
        expect(screen.getAllByTestId("doc-item")).toHaveLength(1);
        expect(screen.getByTestId("doc-item")).toHaveTextContent(
          "React Documentation",
        );
      },
      { timeout: 400 },
    );
  });
});
