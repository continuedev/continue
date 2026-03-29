import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  IdeMessengerContext,
  type IIdeMessenger,
} from "../../context/IdeMessenger";
import { OutOfCreditsDialog } from "./OutOfCreditsDialog";

function createMockMessenger(): IIdeMessenger {
  return {
    post: vi.fn(),
    request: vi.fn(),
    respond: vi.fn(),
    streamRequest: vi.fn(),
    ide: {
      openUrl: vi.fn(),
    } as any,
  } as any;
}

function renderDialog(messenger = createMockMessenger()) {
  render(
    <IdeMessengerContext.Provider value={messenger}>
      <OutOfCreditsDialog />
    </IdeMessengerContext.Provider>,
  );
  return { messenger };
}

describe("OutOfCreditsDialog", () => {
  it("renders the no-credits message", () => {
    renderDialog();
    expect(
      screen.getByText("You have no credits remaining on your Continue account"),
    ).toBeInTheDocument();
  });

  it("renders Purchase Credits button", () => {
    renderDialog();
    expect(screen.getByText("Purchase Credits")).toBeInTheDocument();
  });

  it("renders Add API key secret button", () => {
    renderDialog();
    expect(screen.getByText("Add API key secret")).toBeInTheDocument();
  });

  it("explains how to switch to the direct anthropic provider", () => {
    renderDialog();
    expect(screen.getByText(/your own API key/i)).toBeInTheDocument();
    // The word "anthropic" appears as <code> inside the text
    expect(screen.getByText("anthropic")).toBeInTheDocument();
  });

  it("calls controlPlane/openUrl with billing path when Purchase Credits is clicked", () => {
    const { messenger } = renderDialog();
    fireEvent.click(screen.getByText("Purchase Credits"));
    expect(messenger.post).toHaveBeenCalledWith("controlPlane/openUrl", {
      path: "/settings/billing",
    });
  });

  it("calls openUrl with Anthropic secrets URL when Add API key secret is clicked", () => {
    const { messenger } = renderDialog();
    fireEvent.click(screen.getByText("Add API key secret"));
    expect(messenger.post).toHaveBeenCalledWith(
      "openUrl",
      expect.stringContaining("ANTHROPIC_API_KEY"),
    );
  });

  it("does NOT render GitHub report buttons", () => {
    renderDialog();
    expect(screen.queryByText(/open github issue/i)).not.toBeInTheDocument();
  });
});
