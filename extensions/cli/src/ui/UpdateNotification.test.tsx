// Mock the version module before any other imports
vi.mock("../version.js", () => ({
  getVersion: vi.fn(),
  getLatestVersion: vi.fn(),
  compareVersions: vi.fn(),
}));

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

import * as versionModule from "../version.js";

import { UpdateNotification } from "./UpdateNotification.js";

const mockVersionModule = vi.mocked(versionModule);

describe("UpdateNotification", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    // Default mock implementations
    mockVersionModule.getLatestVersion.mockResolvedValue("1.0.1");
    mockVersionModule.compareVersions.mockReturnValue("older");
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("should not check for updates when version ends with -dev", async () => {
    // Set NODE_ENV to non-test value to enable update checks
    process.env.NODE_ENV = "development";
    mockVersionModule.getVersion.mockReturnValue("1.0.0-dev");

    render(<UpdateNotification />);

    // Wait a bit to ensure useEffect has run
    await new Promise((resolve) => setTimeout(resolve, 50));

    // getLatestVersion should not have been called for dev versions
    expect(mockVersionModule.getLatestVersion).not.toHaveBeenCalled();
  });

  it("should check for updates when version does not end with -dev", async () => {
    // Set NODE_ENV to non-test value to enable update checks
    process.env.NODE_ENV = "development";
    mockVersionModule.getVersion.mockReturnValue("1.0.0");

    render(<UpdateNotification />);

    // Wait a bit to ensure useEffect has run
    await new Promise((resolve) => setTimeout(resolve, 50));

    // getLatestVersion should have been called for non-dev versions
    expect(mockVersionModule.getLatestVersion).toHaveBeenCalled();
  });

  it("should handle various dev version formats", async () => {
    // Set NODE_ENV to non-test value to enable update checks
    process.env.NODE_ENV = "development";
    const devVersions = ["1.0.0-dev", "2.1.3-dev", "0.5.0-dev"];

    for (const version of devVersions) {
      vi.clearAllMocks();
      mockVersionModule.getVersion.mockReturnValue(version);

      render(<UpdateNotification />);

      // Wait a bit to ensure useEffect has run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockVersionModule.getLatestVersion).not.toHaveBeenCalled();
    }
  });

  it("should still check for updates with other version suffixes", async () => {
    // Set NODE_ENV to non-test value to enable update checks
    process.env.NODE_ENV = "development";
    const nonDevVersions = ["1.0.0-beta", "1.0.0-alpha", "1.0.0-rc1"];

    for (const version of nonDevVersions) {
      vi.clearAllMocks();
      mockVersionModule.getVersion.mockReturnValue(version);

      render(<UpdateNotification />);

      // Wait a bit to ensure useEffect has run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockVersionModule.getLatestVersion).toHaveBeenCalled();
    }
  });
});
