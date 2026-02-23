import { createStore } from "@reduxjs/toolkit";
import * as Sentry from "@sentry/react";
import { render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import React from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../context/Auth";
import TelemetryProviders from "./TelemetryProviders";

// Mock Sentry
vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  getClient: vi.fn(),
  getCurrentScope: vi.fn(() => ({
    clear: vi.fn(),
  })),
  browserTracingIntegration: vi.fn(() => ({ name: "BrowserTracing" })),
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
  feedbackIntegration: vi.fn(() => ({ name: "Feedback" })),
  contextLinesIntegration: vi.fn(() => ({ name: "ContextLines" })),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sentry-error-boundary">{children}</div>
  ),
}));

// Mock PostHog
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

// Mock PostHog React provider
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
}));

// Mock the Auth context
vi.mock("../context/Auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
  useAuth: () => ({
    session: {
      account: {
        id: "test@continue.dev", // Mock Continue team member email
      },
    },
  }),
}));

// Mock isContinueTeamMember utility
vi.mock("../util/isContinueTeamMember", () => ({
  isContinueTeamMember: vi.fn(() => true), // Mock as Continue team member
}));

// Mock window.vscMachineId
Object.defineProperty(window, "vscMachineId", {
  value: "test-machine-id",
  writable: true,
});

// Create a minimal Redux store for testing
const createTestStore = (allowAnonymousTelemetry: boolean) => {
  return createStore(
    (
      state = {
        config: {
          config: {
            allowAnonymousTelemetry,
          },
        },
      },
    ) => state,
  );
};

// Mock persistor
const mockPersistor = {
  persist: vi.fn(),
  purge: vi.fn(),
  flush: vi.fn(),
  pause: vi.fn(),
  getState: vi.fn(() => ({
    bootstrapped: true,
    registry: [],
  })),
  dispatch: vi.fn(),
  subscribe: vi.fn(),
};

const TestWrapper: React.FC<{
  children: React.ReactNode;
  allowAnonymousTelemetry: boolean;
}> = ({ children, allowAnonymousTelemetry }) => {
  const store = createTestStore(allowAnonymousTelemetry);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={mockPersistor}>
        <AuthProvider>{children}</AuthProvider>
      </PersistGate>
    </Provider>
  );
};

describe("TelemetryProviders", () => {
  const mockSentry = Sentry as any;
  const mockPosthog = posthog as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset NODE_ENV to test
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("when telemetry is enabled", () => {
    it("should initialize both PostHog and Sentry", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      render(
        <TestWrapper allowAnonymousTelemetry={true}>
          <TelemetryProviders>
            <div data-testid="test-child">Test Child</div>
          </TelemetryProviders>
        </TestWrapper>,
      );

      // Verify PostHog initialization
      expect(mockPosthog.init).toHaveBeenCalledWith(
        "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs",
        expect.objectContaining({
          api_host: "https://app.posthog.com",
          disable_session_recording: true,
          autocapture: false,
          capture_pageleave: false,
          capture_pageview: false,
        }),
      );
      expect(mockPosthog.identify).toHaveBeenCalledWith("test-machine-id");
      expect(mockPosthog.opt_in_capturing).toHaveBeenCalled();

      // Verify Sentry initialization
      expect(mockSentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://fe99934dcdc537d84209893a3f96a196@o4505462064283648.ingest.us.sentry.io/4508184596054016",
          environment: "development",
          tracesSampleRate: 0.25,
        }),
      );
      expect(mockSentry.setUser).toHaveBeenCalledWith({
        id: expect.stringMatching(/^[a-f0-9]{8}$/), // Should be 8-char hash
        email: undefined,
        username: undefined,
        ip_address: undefined,
      });

      // Verify children are rendered
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe("when telemetry is disabled", () => {
    it("should disable PostHog and clear Sentry scope", () => {
      const mockClear = vi.fn();
      const mockClose = vi.fn();
      const mockClient = { close: mockClose };

      mockSentry.getCurrentScope.mockReturnValue({ clear: mockClear });
      mockSentry.getClient.mockReturnValue(mockClient);

      render(
        <TestWrapper allowAnonymousTelemetry={false}>
          <TelemetryProviders>
            <div data-testid="test-child">Test Child</div>
          </TelemetryProviders>
        </TestWrapper>,
      );

      // Verify PostHog is disabled
      expect(mockPosthog.opt_out_capturing).toHaveBeenCalled();
      expect(mockPosthog.init).not.toHaveBeenCalled();
      expect(mockPosthog.identify).not.toHaveBeenCalled();
      expect(mockPosthog.opt_in_capturing).not.toHaveBeenCalled();

      // Verify Sentry is properly disabled
      expect(mockSentry.getClient).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockSentry.getCurrentScope).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
      expect(mockSentry.init).not.toHaveBeenCalled();
      expect(mockSentry.setUser).not.toHaveBeenCalled();

      // Verify children are still rendered
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();
    });
  });

  describe("provider structure", () => {
    it("should wrap children with PostHogProvider", () => {
      render(
        <TestWrapper allowAnonymousTelemetry={false}>
          <TelemetryProviders>
            <div data-testid="nested-child">
              <span data-testid="deeply-nested">Deep content</span>
            </div>
          </TelemetryProviders>
        </TestWrapper>,
      );

      // Verify the provider structure is maintained
      expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();
      expect(screen.getByTestId("nested-child")).toBeInTheDocument();
      expect(screen.getByTestId("deeply-nested")).toBeInTheDocument();
    });

    it("should handle missing vscMachineId gracefully", () => {
      // Temporarily modify vscMachineId
      const originalMachineId = window.vscMachineId;
      (window as any).vscMachineId = undefined;

      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      render(
        <TestWrapper allowAnonymousTelemetry={true}>
          <TelemetryProviders>
            <div data-testid="test-child">Test Child</div>
          </TelemetryProviders>
        </TestWrapper>,
      );

      // Should still initialize but with anonymized ID (hashed "anonymous")
      expect(mockSentry.setUser).toHaveBeenCalledWith({
        id: expect.stringMatching(/^[a-f0-9]{8}$/), // Should be 8-char hash
        email: undefined,
        username: undefined,
        ip_address: undefined,
      });

      // Restore
      (window as any).vscMachineId = originalMachineId;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe("telemetry toggle behavior", () => {
    it("should maintain proper state when telemetry setting changes", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      // First render with telemetry enabled
      const { rerender } = render(
        <TestWrapper allowAnonymousTelemetry={true}>
          <TelemetryProviders>
            <div data-testid="test-child">Test Child</div>
          </TelemetryProviders>
        </TestWrapper>,
      );

      expect(mockSentry.init).toHaveBeenCalled();
      expect(mockPosthog.opt_in_capturing).toHaveBeenCalled();

      // Clear mocks and rerender with telemetry disabled
      vi.clearAllMocks();
      const mockClear = vi.fn();
      const mockClose = vi.fn();
      const mockClient = { close: mockClose };

      mockSentry.getCurrentScope.mockReturnValue({ clear: mockClear });
      mockSentry.getClient.mockReturnValue(mockClient);

      rerender(
        <TestWrapper allowAnonymousTelemetry={false}>
          <TelemetryProviders>
            <div data-testid="test-child">Test Child</div>
          </TelemetryProviders>
        </TestWrapper>,
      );

      expect(mockPosthog.opt_out_capturing).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
      expect(mockSentry.init).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
