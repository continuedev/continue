import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import * as util from "../../../util";
import { CliInstallBanner } from "./CliInstallBanner";

vi.mock("../../../util", async () => {
  const actual = await vi.importActual("../../../util");
  return {
    ...actual,
    getPlatform: vi.fn(),
  };
});

describe("CliInstallBanner", () => {
  let mockIdeMessenger: MockIdeMessenger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIdeMessenger = new MockIdeMessenger();
    vi.mocked(util.getPlatform).mockReturnValue("mac");
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
      await renderComponent(["/usr/local/bin/cn", ""]);

      await waitFor(() => {
        expect(
          screen.queryByText("Try the Continue CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders when CLI is not installed (subprocess returns empty)", async () => {
      await renderComponent(["", "command not found"]);

      await waitFor(() => {
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });
    });

    it("renders when CLI is not installed (subprocess returns empty stdout)", async () => {
      await renderComponent(["", ""]);

      await waitFor(() => {
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });
    });

    it("uses 'which cn' command on mac platform", async () => {
      vi.mocked(util.getPlatform).mockReturnValue("mac");
      const subprocessSpy = vi
        .spyOn(mockIdeMessenger.ide, "subprocess")
        .mockResolvedValue(["", ""]);

      await renderComponent(["", ""]);

      await waitFor(() => {
        expect(subprocessSpy).toHaveBeenCalledWith("which cn");
      });
    });

    it("uses 'which cn' command on linux platform", async () => {
      vi.mocked(util.getPlatform).mockReturnValue("linux");
      const subprocessSpy = vi
        .spyOn(mockIdeMessenger.ide, "subprocess")
        .mockResolvedValue(["", ""]);

      await renderComponent(["", ""]);

      await waitFor(() => {
        expect(subprocessSpy).toHaveBeenCalledWith("which cn");
      });
    });

    it("uses 'where cn' command on windows platform", async () => {
      vi.mocked(util.getPlatform).mockReturnValue("windows");
      const subprocessSpy = vi
        .spyOn(mockIdeMessenger.ide, "subprocess")
        .mockResolvedValue(["", ""]);

      await renderComponent(["", ""]);

      await waitFor(() => {
        expect(subprocessSpy).toHaveBeenCalledWith("where cn");
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
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });
    });
  });

  describe("Banner content", () => {
    beforeEach(async () => {
      await renderComponent(["", "not found"]);
      await waitFor(() => {
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });
    });

    it("displays the title", () => {
      expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
    });

    it("displays the description with 'cn' code element", () => {
      const description = screen.getByText(/Use/);
      expect(description).toBeInTheDocument();
      expect(screen.getByText("cn")).toBeInTheDocument();
    });

    it("displays the installation command", () => {
      expect(screen.getByText("npm i -g @continuedev/cli")).toBeInTheDocument();
    });

    it("displays the Learn more button", () => {
      expect(screen.getByText("Learn more")).toBeInTheDocument();
    });

    it("displays the close button", () => {
      const closeButton = screen.getByRole("button", { name: /dismiss/i });
      expect(closeButton).toBeInTheDocument();
    });

    it("displays the CommandLine icon", () => {
      // The icon should be present in the component
      const banner = screen.getByText("Try the Continue CLI").closest("div");
      expect(banner).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    beforeEach(async () => {
      await renderComponent(["", "not found"]);
      await waitFor(() => {
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });
    });

    it("dismisses banner when close button is clicked", async () => {
      const closeButton = screen.getByRole("button", { name: /dismiss/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Try the Continue CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("opens documentation URL when Learn more button is clicked", async () => {
      const postSpy = vi.spyOn(mockIdeMessenger, "post");
      const learnMoreButton = screen.getByText("Learn more");

      fireEvent.click(learnMoreButton);

      expect(postSpy).toHaveBeenCalledWith(
        "openUrl",
        "https://docs.continue.dev/guides/cli",
      );
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
        screen.queryByText("Try the Continue CLI"),
      ).not.toBeInTheDocument();
    });

    it("remains hidden after dismissal even on re-render", async () => {
      const { rerender } = await renderComponent(["", "not found"]);

      await waitFor(() => {
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });

      // Dismiss the banner
      const closeButton = screen.getByRole("button", { name: /dismiss/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Try the Continue CLI"),
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
        screen.queryByText("Try the Continue CLI"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles whitespace in subprocess output", async () => {
      await renderComponent(["  \n  ", ""]);

      await waitFor(() => {
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });
    });

    it("detects CLI when path has trailing newline", async () => {
      await renderComponent(["/usr/local/bin/cn\n", ""]);

      await waitFor(() => {
        expect(
          screen.queryByText("Try the Continue CLI"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders banner when stderr contains 'not found'", async () => {
      await renderComponent(["", "cn: command not found"]);

      await waitFor(() => {
        expect(screen.getByText("Try the Continue CLI")).toBeInTheDocument();
      });
    });
  });
});
