// Mock useTerminalSize hook
vi.mock("./hooks/useTerminalSize.js", () => ({
  useTerminalSize: () => ({ columns: 80, rows: 24 }),
}));

// Mock sentry to prevent initialization issues
vi.mock("../sentry.js", () => ({
  sentryService: {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    addBreadcrumb: vi.fn(),
    startSpan: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(false),
  },
}));

import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpdateStatus } from "../services/types.js";

import { UpdateNotification } from "./UpdateNotification.js";

// Mock useServices hook
const mockUseServices = vi.fn();
vi.mock("../hooks/useService.js", () => ({
  useServices: () => mockUseServices(),
}));

describe("UpdateNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation - no update available
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.IDLE,
          message: "Continue CLI v1.0.0",
          error: null,
          isUpdateAvailable: false,
          latestVersion: null,
          currentVersion: "1.0.0",
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should show default message when no update is available", () => {
    const { lastFrame } = render(<UpdateNotification />);

    expect(lastFrame()).toContain("◉ Continue CLI v1.0.0");
  });

  it("should show update available message when update is available", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.IDLE,
          message: "Update available: v1.0.1",
          error: null,
          isUpdateAvailable: true,
          latestVersion: "1.0.1",
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification />);

    expect(lastFrame()).toContain("◉ Update available: v1.0.1");
  });

  it("should show checking message when checking for updates", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.CHECKING,
          message: "Checking for updates",
          error: null,
          isUpdateAvailable: false,
          latestVersion: null,
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification />);

    expect(lastFrame()).toContain("◉ Checking for updates");
  });

  it("should show updating message when updating", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.UPDATING,
          message: "Updating to v1.0.1",
          error: null,
          isUpdateAvailable: false,
          latestVersion: "1.0.1",
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification />);

    expect(lastFrame()).toContain("Updating to v1.0.1");
  });

  it("should show updated message when update completes", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.UPDATED,
          message: "Auto-updated to v1.0.1",
          error: null,
          isUpdateAvailable: false,
          latestVersion: "1.0.1",
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification />);

    expect(lastFrame()).toContain("◉ Auto-updated to v1.0.1");
  });

  it("should show error message when update fails", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.ERROR,
          message: "Update failed",
          error: new Error("Update error"),
          isUpdateAvailable: true,
          latestVersion: "1.0.1",
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification />);

    expect(lastFrame()).toContain("◉ Update failed");
  });

  it("should show remote mode when in remote mode and no update available", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.IDLE,
          message: "Continue CLI v1.0.0",
          error: null,
          isUpdateAvailable: false,
          latestVersion: null,
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification isRemoteMode={true} />);

    expect(lastFrame()).toContain("◉ Remote Mode");
  });

  it("should show update message even in remote mode when update is available", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.IDLE,
          message: "Update available: v1.0.1",
          error: null,
          isUpdateAvailable: true,
          latestVersion: "1.0.1",
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification isRemoteMode={true} />);

    expect(lastFrame()).toContain("◉ Update available: v1.0.1");
  });

  it("should show default message when update service has no message", () => {
    mockUseServices.mockReturnValue({
      services: {
        update: {
          autoUpdate: true,
          status: UpdateStatus.IDLE,
          message: "",
          error: null,
          isUpdateAvailable: false,
          latestVersion: null,
          currentVersion: "1.0.0",
        },
      },
    });

    const { lastFrame } = render(<UpdateNotification />);

    expect(lastFrame()).toContain("◉ Continue CLI");
  });
});
