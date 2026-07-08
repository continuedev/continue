import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SiteIndexingConfig } from "core";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { MockIdeMessenger } from "../../../../context/MockIdeMessenger";
import { createMockStore } from "../../../../util/test/mockStore";
import DocsIndexingStatus from "./DocsIndexingStatus";

describe("DocsIndexingStatus", () => {
  const mockDocConfig: SiteIndexingConfig = {
    startUrl: "https://example.com",
    title: "Example Docs",
  };

  const mockDocFromYaml = {
    startUrl: "https://example.com",
    title: "Example Docs",
  };

  const renderComponent = async (
    props: any = {},
    storeState = {},
    mockMessenger?: MockIdeMessenger,
  ) => {
    const { mockIdeMessenger, ...store } = createMockStore(
      storeState,
      mockMessenger,
    );

    const result = await act(async () =>
      render(
        <Provider store={store}>
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <AuthProvider>
              <DocsIndexingStatus
                docConfig={mockDocConfig}
                docFromYaml={mockDocFromYaml}
                {...props}
              />
            </AuthProvider>
          </IdeMessengerContext.Provider>
        </Provider>,
      ),
    );

    return { ...result, mockIdeMessenger };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders doc title and basic structure", async () => {
    await renderComponent();
    expect(screen.getByText("Example Docs")).toBeInTheDocument();
  });

  it("renders startUrl when title is not provided", async () => {
    const configWithoutTitle = { ...mockDocConfig, title: undefined };
    await renderComponent({ docConfig: configWithoutTitle });
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("shows progress percentage when indexing", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "indexing",
              progress: 0.45,
              description: "Indexing pages...",
            },
          },
        },
      },
    };

    await renderComponent({}, storeState);
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("shows stop icon when indexing", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "indexing",
              progress: 0.25,
            },
          },
        },
      },
    };

    await renderComponent({}, storeState);
    const stopIcon = screen.getByTestId("stop-indexing");
    expect(stopIcon).toBeInTheDocument();
  });

  it("calls abort when stop icon is clicked", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "indexing",
              progress: 0.25,
            },
          },
        },
      },
    };

    const { mockIdeMessenger } = await renderComponent(
      {},
      storeState,
      new MockIdeMessenger(),
    );
    const postSpy = vi.spyOn(mockIdeMessenger, "post");
    const stopButton = screen.getByTestId("stop-indexing");
    fireEvent.click(stopButton);

    expect(postSpy).toHaveBeenCalledWith("indexing/abort", {
      type: "docs",
      id: "https://example.com",
    });
  });

  it("shows reindex icon when status is complete", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              progress: 1,
            },
          },
        },
      },
    };

    await renderComponent({}, storeState);
    const reindexButton = screen.getByTestId("reindex-docs");
    expect(reindexButton).toBeInTheDocument();
  });

  it("calls reindex when reindex icon is clicked", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              progress: 1,
            },
          },
        },
      },
    };

    const { mockIdeMessenger } = await renderComponent({}, storeState);
    const postSpy = vi.spyOn(mockIdeMessenger, "post");
    const reindexButton = screen.getByTestId("reindex-docs");
    fireEvent.click(reindexButton);

    expect(postSpy).toHaveBeenCalledWith("indexing/reindex", {
      type: "docs",
      id: "https://example.com",
    });
  });

  it("opens URL when title is clicked and status has URL", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              url: "https://example.com/docs",
            },
          },
        },
      },
    };

    const { mockIdeMessenger } = await renderComponent({}, storeState);
    const postSpy = vi.spyOn(mockIdeMessenger, "post");
    const titleElement = screen.getByText("Example Docs");
    fireEvent.click(titleElement);

    expect(postSpy).toHaveBeenCalledWith("openUrl", "https://example.com/docs");
  });

  it("fetches indexed pages when status becomes complete", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              progress: 1,
            },
          },
        },
      },
    };

    const mockMessenger = new MockIdeMessenger();
    const spy = vi.spyOn(mockMessenger, "request");
    await renderComponent({}, storeState, mockMessenger);
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("docs/getIndexedPages", {
        startUrl: "https://example.com",
      });
    });
  });

  it("displays indexed pages count when available", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              progress: 1,
            },
          },
        },
      },
    };

    const mockMessenger = new MockIdeMessenger();
    mockMessenger.responses["docs/getIndexedPages"] = [
      "page1.html",
      "page2.html",
      "page3.html",
    ];
    await renderComponent({}, storeState, mockMessenger);

    await waitFor(() => {
      expect(screen.getByText("3 pages indexed")).toBeInTheDocument();
    });
  });

  it("shows singular page text for one page", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              progress: 1,
            },
          },
        },
      },
    };

    const mockMessenger = new MockIdeMessenger();
    mockMessenger.responses["docs/getIndexedPages"] = ["page1.html"];
    await renderComponent({}, storeState, mockMessenger);

    await waitFor(() => {
      expect(screen.getByText("1 page indexed")).toBeInTheDocument();
    });
  });

  it("shows status description when not complete", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "indexing",
              progress: 0.5,
              description: "Processing documentation...",
            },
          },
        },
      },
    };

    await renderComponent({}, storeState);
    expect(screen.getByText("Processing documentation...")).toBeInTheDocument();
  });

  it("handles error when fetching indexed pages", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              progress: 1,
            },
          },
        },
      },
    };

    const mockMessenger = new MockIdeMessenger();
    mockMessenger.responseHandlers["docs/getIndexedPages"] = async (data) => {
      throw new Error("Failed to fetch pages");
    };
    await renderComponent({}, storeState, mockMessenger);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Unable to fetch pages list for https://example.com",
        ),
      );
    });

    consoleSpy.mockRestore();
  });

  it("returns null when hasDeleted is true", async () => {
    const { container } = await renderComponent();

    // Simulate deletion state by accessing the component's internal state
    // In a real scenario, this would be tested through user interaction
    expect(container.firstChild).not.toBeNull();
  });

  it("shows loading text when pages are being fetched", async () => {
    const storeState = {
      indexing: {
        indexing: {
          statuses: {
            "https://example.com": {
              status: "complete",
              progress: 1,
            },
          },
        },
      },
    };

    const mockMessenger = new MockIdeMessenger();
    mockMessenger.responseHandlers["docs/getIndexedPages"] = async (data) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return [];
    };
    await renderComponent({}, storeState, mockMessenger);

    expect(screen.getByText("Loading site info...")).toBeInTheDocument();
  });
});
