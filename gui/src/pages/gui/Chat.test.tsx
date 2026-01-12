import { cleanup } from "@testing-library/react";
import { Virtuoso } from "react-virtuoso";
import { renderWithProviders } from "../../util/test/render";
import { Chat } from "./Chat";

// Mock react-virtuoso
vi.mock("react-virtuoso", () => ({
  Virtuoso: vi.fn(() => null),
}));

describe("Chat", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render Virtuoso with correct virtualization verification props", async () => {
    await renderWithProviders(<Chat />);

    expect(Virtuoso).toHaveBeenCalledWith(
      expect.objectContaining({
        overscan: 200,
        atBottomThreshold: 50,
      }),
      expect.anything(),
    );
  });
});
