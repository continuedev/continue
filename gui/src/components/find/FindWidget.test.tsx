import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useFindWidget } from "./FindWidget";

// Test component that uses the find widget
const TestComponent = () => {
  const searchRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const { widget, highlights, open, setOpen } = useFindWidget(
    searchRef,
    headerRef,
    [],
    false,
  );

  return (
    <div>
      {widget}
      <div ref={headerRef} className="header">
        Header Content
      </div>
      <div
        ref={searchRef}
        className="relative"
        style={{ height: "400px", overflow: "auto" }}
      >
        <p>This is a test paragraph</p>
        <p>We can search for content here</p>
        <p>Multiple instances of test should work</p>
        {highlights}
      </div>
      <button onClick={() => setOpen(true)}>Open Search</button>
    </div>
  );
};

describe("FindWidget", () => {
  beforeEach(() => {
    // Reset window size and scroll position
    window.innerHeight = 768;
    window.innerWidth = 1024;
  });

  it("should open search widget and find matches", async () => {
    render(<TestComponent />);

    // Open search widget
    const openButton = screen.getByText("Open Search");
    fireEvent.click(openButton);

    // Find search input
    const searchInput = screen.getByPlaceholderText("Search...");
    expect(searchInput).toBeInTheDocument();

    // Type search term
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "test" } });
      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    // Check if matches are found (should find 2 instances of "test")
    const matchCount = screen.getByText("1 of 2");
    expect(matchCount).toBeInTheDocument();

    // Test case sensitivity toggle
    const caseSensitiveButton = screen.getByText("Aa");
    fireEvent.click(caseSensitiveButton);

    // Check highlight elements
    const highlights = document.querySelectorAll(
      ".bg-findMatch\\/50, .bg-findMatch-selected\\/50",
    );
    expect(highlights.length).toBe(2);
  });

  it("should navigate between matches", async () => {
    render(
      //   <Provider store={store}>
      <TestComponent />,
      //   </Provider>
    );

    // Open search and type
    fireEvent.click(screen.getByText("Open Search"));
    const searchInput = screen.getByPlaceholderText("Search...");

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "test" } });
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    // Find navigation buttons
    const nextButton = screen.getByText("Next Match");
    const prevButton = screen.getByText("Previous Match");

    // Navigate through matches
    fireEvent.click(nextButton);
    expect(screen.getByText("2 of 2")).toBeInTheDocument();

    fireEvent.click(prevButton);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });
});
