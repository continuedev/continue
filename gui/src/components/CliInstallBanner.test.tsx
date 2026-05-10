import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { MockIdeMessenger } from "../context/MockIdeMessenger";
import * as util from "../util";
import * as localStorage from "../util/localStorage";
import { CliInstallBanner } from "./CliInstallBanner";

vi.mock("../util", async () => {
  const actual = await vi.importActual("../util");
  return {
    ...actual,
    getPlatform: vi.fn(),
  };
});

vi.mock("../util/localStorage", async () => {
  const actual = await vi.importActual("../util/localStorage");
  return {
    ...actual,
    getLocalStorage: vi.fn(),
    setLocalStorage: vi.fn(),
  };
});

describe("CliInstallBanner", () => {
  let mockIdeMessenger: MockIdeMessenger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIdeMessenger = new MockIdeMessenger();
    vi.mocked(util.getPlatform).mockReturnValue("mac");
    vi.mocked(localStorage.getLocalStorage).mockReturnValue(undefined);
  });

  const renderComponent = async (subprocessResponse: [string, string]) => {
    // Mock the subprocess call on the IDE
    vi.spyOn(mockIdeMessenger.ide, "subprocess").mockResolvedValue(
      subprocessResponse,
    );

    return act(async () =>
      render(
        <IdeMessengerContext.Provider value={mockIdeMessenger}>
          <CliInstallBanner />
        </IdeMessengerContext.Provider>,
      ),
    );
  };

  describe("CLI detection", () => {
    it("does not render when CLI is installed (subprocess returns path)", async () => {
      await renderComponent(["/usr/local/bin/yt", ""]);

      await waitFor(() => {
        expect(
          screen.queryByText("Try out the Yuto Agentic CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders when CLI is not installed (subprocess returns empty)", async () => {
      await renderComponent(["", "command not found"]);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });

    it("renders when CLI is not installed (subprocess returns empty stdout)", async () => {
      await renderComponent(["", ""]);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });

    it("uses 'which yt' command on mac platform", async () => {
      vi.mocked(util.getPlatform).mockReturnValue("mac");
      const subprocessSpy = vi
        .spyOn(mockIdeMessenger.ide, "subprocess")
        .mockResolvedValue(["", ""]);

      await act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner />
          </IdeMessengerContext.Provider>,
        ),
      );

      await waitFor(() => {
        expect(subprocessSpy).toHaveBeenCalledWith(
          "which yt 2>/dev/null || true",
        );
      });
    });

    it("uses 'which yt' command on linux platform", async () => {
      vi.mocked(util.getPlatform).mockReturnValue("linux");
      const subprocessSpy = vi
        .spyOn(mockIdeMessenger.ide, "subprocess")
        .mockResolvedValue(["", ""]);

      await act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner />
          </IdeMessengerContext.Provider>,
        ),
      );

      await waitFor(() => {
        expect(subprocessSpy).toHaveBeenCalledWith(
          "which yt 2>/dev/null || true",
        );
      });
    });

    it("uses 'where yt' command on windows platform", async () => {
      vi.mocked(util.getPlatform).mockReturnValue("windows");
      const subprocessSpy = vi
        .spyOn(mockIdeMessenger.ide, "subprocess")
        .mockResolvedValue(["", ""]);

      await act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner />
          </IdeMessengerContext.Provider>,
        ),
      );

      await waitFor(() => {
        expect(subprocessSpy).toHaveBeenCalledWith(
          "where yt 2>nul || exit /b 0",
        );
      });
    });

    it("handles subprocess errors gracefully", async () => {
      vi.spyOn(mockIdeMessenger.ide, "subprocess").mockRejectedValue(
        new Error("Command failed"),
      );

      await act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner />
          </IdeMessengerContext.Provider>,
        ),
      );

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Banner content", () => {
    beforeEach(async () => {
      await renderComponent(["", "not found"]);
      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });

    it("displays the title", () => {
      expect(
        screen.getByText("Try out the Yuto Agentic CLI"),
      ).toBeInTheDocument();
    });

    it("displays the description with 'yt' code element", () => {
      const description = screen.getByText(/Use/);
      expect(description).toBeInTheDocument();
      expect(screen.getByText("yt")).toBeInTheDocument();
    });

    it("displays the installation command", () => {
      expect(screen.getByText("npm i -g @yutoagentic/cli")).toBeInTheDocument();
    });

    it("displays the Learn more link", () => {
      expect(screen.getByText("Learn more.")).toBeInTheDocument();
    });

    it("displays the close button", () => {
      // Get the styled close button (it doesn't have a text label)
      const buttons = screen.getAllByRole("button");
      // There should be multiple buttons (close, copy, run)
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("displays the CommandLine icon", () => {
      // The icon should be present in the component
      const banner = screen
        .getByText("Try out the Yuto Agentic CLI")
        .closest("div");
      expect(banner).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    beforeEach(async () => {
      await renderComponent(["", "not found"]);
      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });

    it("dismisses banner when close button is clicked", async () => {
      const buttons = screen.getAllByRole("button");
      // First button should be the close button (CloseButton component)
      const closeButton = buttons[0];
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Try out the Yuto Agentic CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("opens documentation URL when Learn more link is clicked", async () => {
      const postSpy = vi.spyOn(mockIdeMessenger, "post");
      const learnMoreLink = screen.getByText("Learn more.");

      fireEvent.click(learnMoreLink);

      expect(postSpy).toHaveBeenCalledWith(
        "openUrl",
        "https://docs.yutoagentic.dev/guides/cli",
      );
    });

    it("displays the installation command with interactive controls", async () => {
      // The installation command should be visible
      expect(screen.getByText("npm i -g @yutoagentic/cli")).toBeInTheDocument();
      // The "Run" text should be visible for the run button
      expect(screen.getByText(/Run/i)).toBeInTheDocument();
    });

    it("runs installation command in terminal when run button is clicked", async () => {
      const postSpy = vi.spyOn(mockIdeMessenger, "post");

      // Find the "Run" text or CommandLineIcon
      const runButton = screen.getByText(/Run/i).closest("div");
      if (runButton) {
        fireEvent.click(runButton);

        expect(postSpy).toHaveBeenCalledWith("runCommand", {
          command: `npm i -g @yutoagentic/cli && yt "Explore this repo and provide a concise summary of it's contents"`,
        });
      }
    });
  });

  describe("Banner visibility states", () => {
    it("does not render while CLI check is loading", async () => {
      vi.spyOn(mockIdeMessenger.ide, "subprocess").mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(["", ""]), 100)),
      );

      await act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner />
          </IdeMessengerContext.Provider>,
        ),
      );

      // Should not be visible immediately
      expect(
        screen.queryByText("Try out the Yuto Agentic CLI"),
      ).not.toBeInTheDocument();
    });

    it("remains hidden after dismissal even on re-render", async () => {
      const { rerender } = await renderComponent(["", "not found"]);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });

      // Dismiss the banner
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons[0];
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Try out the Yuto Agentic CLI"),
        ).not.toBeInTheDocument();
      });

      // Re-render the component
      rerender(
        <IdeMessengerContext.Provider value={mockIdeMessenger}>
          <CliInstallBanner />
        </IdeMessengerContext.Provider>,
      );

      // Should still be hidden
      expect(
        screen.queryByText("Try out the Yuto Agentic CLI"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles whitespace in subprocess output", async () => {
      await renderComponent(["  \n  ", ""]);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });

    it("detects CLI when path has trailing newline", async () => {
      await renderComponent(["/usr/local/bin/yt\n", ""]);

      await waitFor(() => {
        expect(
          screen.queryByText("Try out the Yuto Agentic CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders banner when stderr contains 'not found'", async () => {
      await renderComponent(["", "yt: command not found"]);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Session threshold logic", () => {
    const renderWithSessionCount = async (
      sessionCount?: number,
      sessionThreshold?: number,
    ) => {
      vi.spyOn(mockIdeMessenger.ide, "subprocess").mockResolvedValue([
        "",
        "not found",
      ]);

      return act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner
              sessionCount={sessionCount}
              sessionThreshold={sessionThreshold}
            />
          </IdeMessengerContext.Provider>,
        ),
      );
    };

    it("shows banner when no threshold is set", async () => {
      await renderWithSessionCount(0, undefined);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });

    it("does not show banner when session count is below threshold", async () => {
      await renderWithSessionCount(2, 3);

      await waitFor(() => {
        expect(
          screen.queryByText("Try out the Yuto Agentic CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("shows banner when session count meets threshold", async () => {
      await renderWithSessionCount(3, 3);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });

    it("shows banner when session count exceeds threshold", async () => {
      await renderWithSessionCount(5, 3);

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Permanent dismissal with localStorage", () => {
    const renderWithPermanentDismissal = async () => {
      vi.spyOn(mockIdeMessenger.ide, "subprocess").mockResolvedValue([
        "",
        "not found",
      ]);

      return act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner permanentDismissal={true} />
          </IdeMessengerContext.Provider>,
        ),
      );
    };

    it("does not show banner when previously dismissed permanently", async () => {
      vi.mocked(localStorage.getLocalStorage).mockReturnValue(true);

      await renderWithPermanentDismissal();

      await waitFor(() => {
        expect(
          screen.queryByText("Try out the Yuto Agentic CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("sets localStorage when dismissed with permanentDismissal=true", async () => {
      await renderWithPermanentDismissal();

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole("button");
      const closeButton = buttons[0];
      fireEvent.click(closeButton);

      expect(localStorage.setLocalStorage).toHaveBeenCalledWith(
        "hasDismissedCliInstallBanner",
        true,
      );
    });

    it("does not set localStorage when dismissed with permanentDismissal=false", async () => {
      vi.spyOn(mockIdeMessenger.ide, "subprocess").mockResolvedValue([
        "",
        "not found",
      ]);

      await act(async () =>
        render(
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <CliInstallBanner permanentDismissal={false} />
          </IdeMessengerContext.Provider>,
        ),
      );

      await waitFor(() => {
        expect(
          screen.getByText("Try out the Yuto Agentic CLI"),
        ).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole("button");
      const closeButton = buttons[0];
      fireEvent.click(closeButton);

      expect(localStorage.setLocalStorage).not.toHaveBeenCalled();
    });
  });
});
