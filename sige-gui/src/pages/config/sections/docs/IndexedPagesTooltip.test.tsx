import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { createMockStore } from "../../../../util/test/mockStore";
import { IndexedPagesTooltip } from "./IndexedPagesTooltip";

describe("IndexedPagesTooltip", () => {
  const defaultProps = {
    pages: [
      "https://example.com/page1",
      "https://example.com/page2",
      "https://example.com/sub/page3",
    ],
    siteTitle: "Example Documentation",
    baseUrl: "https://example.com",
  };

  const renderComponent = (props = {}, storeState = {}) => {
    const { mockIdeMessenger, ...store } = createMockStore(storeState);

    return {
      ...render(
        <Provider store={store}>
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <IndexedPagesTooltip {...defaultProps} {...props} />
          </IdeMessengerContext.Provider>
        </Provider>,
      ),
      mockIdeMessenger,
      store,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders site title and page count", () => {
    renderComponent();
    expect(
      screen.getByText("Example Documentation - 3 Pages Indexed"),
    ).toBeInTheDocument();
  });

  it("renders all pages in the list", () => {
    renderComponent();

    // Check that all pages are rendered (with baseUrl prefix removed)
    expect(screen.getByText("/page1")).toBeInTheDocument();
    expect(screen.getByText("/page2")).toBeInTheDocument();
    expect(screen.getByText("/sub/page3")).toBeInTheDocument();
  });

  it("removes baseUrl prefix from page URLs", () => {
    const pages = [
      "https://example.com/docs/getting-started",
      "https://example.com/docs/api-reference",
      "https://other-domain.com/page", // This should not have prefix removed
    ];

    renderComponent({ pages, baseUrl: "https://example.com" });

    expect(screen.getByText("/docs/getting-started")).toBeInTheDocument();
    expect(screen.getByText("/docs/api-reference")).toBeInTheDocument();
    expect(
      screen.getByText("https://other-domain.com/page"),
    ).toBeInTheDocument();
  });

  it("handles pages that don't start with baseUrl", () => {
    const pages = [
      "https://different-domain.com/page1",
      "mailto:contact@example.com",
    ];

    renderComponent({ pages });

    expect(
      screen.getByText("https://different-domain.com/page1"),
    ).toBeInTheDocument();
    expect(screen.getByText("mailto:contact@example.com")).toBeInTheDocument();
  });

  it("opens URL when page is clicked", () => {
    const { mockIdeMessenger } = renderComponent();
    const spy = vi.spyOn(mockIdeMessenger, "post");
    const pageLink = screen.getByText("/page1");
    fireEvent.click(pageLink);

    expect(spy).toHaveBeenCalledWith("openUrl", "https://example.com/page1");
  });

  it("opens each page URL correctly when clicked", () => {
    const { mockIdeMessenger } = renderComponent();
    const spy = vi.spyOn(mockIdeMessenger, "post");

    // Click on different pages
    fireEvent.click(screen.getByText("/page2"));
    expect(spy).toHaveBeenCalledWith("openUrl", "https://example.com/page2");

    fireEvent.click(screen.getByText("/sub/page3"));
    expect(spy).toHaveBeenCalledWith(
      "openUrl",
      "https://example.com/sub/page3",
    );
  });

  it("renders empty list when no pages provided", () => {
    renderComponent({ pages: [] });

    expect(
      screen.getByText("Example Documentation - 0 Pages Indexed"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("handles single page correctly", () => {
    const pages = ["https://example.com/single-page"];

    renderComponent({ pages });

    expect(
      screen.getByText("Example Documentation - 1 Pages Indexed"),
    ).toBeInTheDocument();
    expect(screen.getByText("/single-page")).toBeInTheDocument();
  });

  it("preserves page order", () => {
    const pages = [
      "https://example.com/z-last",
      "https://example.com/a-first",
      "https://example.com/m-middle",
    ];

    renderComponent({ pages });

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);

    // Check that the order is preserved as provided, not alphabetically sorted
    expect(listItems[0]).toHaveTextContent("/z-last");
    expect(listItems[1]).toHaveTextContent("/a-first");
    expect(listItems[2]).toHaveTextContent("/m-middle");
  });

  it("applies correct CSS classes for styling", () => {
    renderComponent();

    const pageItems = screen.getAllByRole("listitem");
    pageItems.forEach((item) => {
      expect(item).toHaveClass(
        "my-1",
        "cursor-pointer",
        "truncate",
        "text-left",
        "text-gray-400",
        "hover:underline",
      );
    });
  });

  it("shows scrollable container for long lists", () => {
    // Create a long list of pages
    const longPageList = Array.from(
      { length: 20 },
      (_, i) => `https://example.com/page-${i + 1}`,
    );

    const { container } = renderComponent({ pages: longPageList });

    // Check that the scrollable container exists
    const scrollContainer = container.querySelector(
      ".max-h-48.overflow-y-auto",
    );
    expect(scrollContainer).toBeInTheDocument();

    // Check that all pages are rendered
    expect(
      screen.getByText("Example Documentation - 20 Pages Indexed"),
    ).toBeInTheDocument();
    longPageList.forEach((_, index) => {
      expect(screen.getByText(`/page-${index + 1}`)).toBeInTheDocument();
    });
  });

  describe("removePrefix utility", () => {
    it("removes prefix when string starts with it", () => {
      const pages = ["https://example.com/docs/guide"];
      renderComponent({ pages, baseUrl: "https://example.com" });
      expect(screen.getByText("/docs/guide")).toBeInTheDocument();
    });

    it("returns original string when it doesn't start with prefix", () => {
      const pages = ["https://other-site.com/page"];
      renderComponent({ pages, baseUrl: "https://example.com" });
      expect(
        screen.getByText("https://other-site.com/page"),
      ).toBeInTheDocument();
    });

    it("handles empty prefix", () => {
      const pages = ["https://example.com/page"];
      renderComponent({ pages, baseUrl: "" });
      expect(screen.getByText("https://example.com/page")).toBeInTheDocument();
    });
  });
});
