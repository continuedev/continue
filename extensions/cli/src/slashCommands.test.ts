import type { AssistantUnrolled } from "@continuedev/config-yaml";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest";

import type { AuthConfig, AuthenticatedConfig } from "./auth/workos.js";
import type { ConfigServiceState } from "./services/types.js";
import { handleSlashCommands } from "./slashCommands.js";

// Mock the services
vi.mock("./services/index.js", () => ({
  services: {
    config: {
      getState: vi.fn(),
    },
  },
  reloadService: vi.fn(),
  SERVICE_NAMES: {
    AUTH: "AUTH",
  },
}));

// Mock auth functions
vi.mock("./auth/workos.js", () => ({
  isAuthenticated: vi.fn(),
  isAuthenticatedConfig: vi.fn(),
  loadAuthConfig: vi.fn(),
}));

// Mock telemetry
vi.mock("./telemetry/posthogService.js", () => ({
  posthogService: {
    capture: vi.fn(),
  },
}));

// Mock commands
vi.mock("./commands/commands.js", () => ({
  getAllSlashCommands: vi.fn(() => []),
}));

// Mock logger to avoid file system operations
vi.mock("./util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock env.js to avoid file operations
vi.mock("./env.js", () => ({
  env: {
    continueHome: "/home/test/.continue",
    appUrl: "https://hub.continue.dev",
  },
}));

// Mock os and path
vi.mock("os", () => ({
  default: {
    homedir: vi.fn(() => "/home/test"),
  },
  homedir: vi.fn(() => "/home/test"),
}));

vi.mock("path", () => ({
  default: {
    join: vi.fn((...parts) => parts.join("/")),
  },
  join: vi.fn((...parts) => parts.join("/")),
}));

// Mock session functions
vi.mock("./session.js", () => ({
  getSessionFilePath: vi.fn(
    () => "/home/test/.continue/cli-sessions/continue-cli-pid-12345.json",
  ),
  hasSession: vi.fn(() => false),
  getCurrentSession: vi.fn(() => {
    throw new Error("Session not available");
  }),
}));

describe("slashCommands", () => {
  const mockAssistant: AssistantUnrolled = {
    name: "test-assistant",
    version: "1.0.0",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleSlashCommands", () => {
    it("should handle /help command", async () => {
      const result = await handleSlashCommands("/help", mockAssistant);

      expect(result).toBeDefined();
      expect(result?.output).toContain("Keyboard Shortcuts:");
      expect(result?.output).toContain("Navigation:");
      expect(result?.output).toContain("↑/↓");
      expect(result?.output).toContain("Tab");
      expect(result?.output).toContain("Enter");
      expect(result?.output).toContain("Shift+Enter");
      expect(result?.output).toContain("Controls:");
      expect(result?.output).toContain("Ctrl+C");
      expect(result?.output).toContain("Ctrl+D");
      expect(result?.output).toContain("Ctrl+L");
      expect(result?.output).toContain("Shift+Tab");
      expect(result?.output).toContain("Esc");
      expect(result?.output).toContain("Special Characters:");
      expect(result?.output).toContain("@");
      expect(result?.output).toContain("/");
      expect(result?.exit).toBeUndefined();
    });

    it("should handle /info command when not authenticated", async () => {
      const { isAuthenticated } = await import("./auth/workos.js");
      const { services } = await import("./services/index.js");

      (
        isAuthenticated as MockedFunction<typeof isAuthenticated>
      ).mockReturnValue(false);
      (
        services.config.getState as MockedFunction<
          typeof services.config.getState
        >
      ).mockReturnValue({
        config: null,
        configPath: "/test/config.yaml",
      } as ConfigServiceState);

      const result = await handleSlashCommands("/info", mockAssistant);

      expect(result).toBeDefined();
      expect(result?.output).toContain("Authentication:");
      expect(result?.output).toContain("Not logged in");
      expect(result?.output).toContain("Configuration:");
      expect(result?.output).toContain("/test/config.yaml");
      expect(result?.output).toContain("Session:");
      expect(result?.output).toContain("Session not available");
      expect(result?.exit).toBe(false);
    });

    it("should handle /info command when authenticated via environment", async () => {
      const { isAuthenticated, loadAuthConfig, isAuthenticatedConfig } =
        await import("./auth/workos.js");
      const { services } = await import("./services/index.js");

      (
        isAuthenticated as MockedFunction<typeof isAuthenticated>
      ).mockReturnValue(true);
      (loadAuthConfig as MockedFunction<typeof loadAuthConfig>).mockReturnValue(
        {} as AuthConfig,
      );
      (isAuthenticatedConfig as any).mockReturnValue(false);
      (
        services.config.getState as MockedFunction<
          typeof services.config.getState
        >
      ).mockReturnValue({
        config: null,
        configPath: undefined,
      } as ConfigServiceState);

      const result = await handleSlashCommands("/info", mockAssistant);

      expect(result).toBeDefined();
      expect(result?.output).toContain("Authentication:");
      expect(result?.output).toContain(
        "Authenticated via environment variable",
      );
      expect(result?.output).toContain("Configuration:");
      expect(result?.output).toContain("Config not found");
      expect(result?.exit).toBe(false);
    });

    it("should handle /info command when authenticated with user config", async () => {
      const { isAuthenticated, loadAuthConfig, isAuthenticatedConfig } =
        await import("./auth/workos.js");
      const { services } = await import("./services/index.js");

      const mockAuthConfig: AuthenticatedConfig = {
        userId: "test-user-id",
        userEmail: "test@example.com",
        accessToken: "test-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() + 3600000,
        organizationId: "test-org-id",
      };

      (
        isAuthenticated as MockedFunction<typeof isAuthenticated>
      ).mockReturnValue(true);
      (loadAuthConfig as MockedFunction<typeof loadAuthConfig>).mockReturnValue(
        mockAuthConfig,
      );
      (isAuthenticatedConfig as any).mockReturnValue(true);
      (
        services.config.getState as MockedFunction<
          typeof services.config.getState
        >
      ).mockReturnValue({
        config: null,
        configPath: "/custom/config.yaml",
      } as ConfigServiceState);

      const result = await handleSlashCommands("/info", mockAssistant);

      expect(result).toBeDefined();
      expect(result?.output).toContain("Authentication:");
      expect(result?.output).toContain("test@example.com");
      expect(result?.output).toContain("test-org-id");
      expect(result?.output).toContain("Configuration:");
      expect(result?.output).toContain("/custom/config.yaml");
      expect(result?.exit).toBe(false);
    });

    it("should handle config service errors gracefully", async () => {
      const { isAuthenticated } = await import("./auth/workos.js");
      const { services } = await import("./services/index.js");

      (
        isAuthenticated as MockedFunction<typeof isAuthenticated>
      ).mockReturnValue(false);
      (
        services.config.getState as MockedFunction<
          typeof services.config.getState
        >
      ).mockImplementation(() => {
        throw new Error("Service not ready");
      });

      const result = await handleSlashCommands("/info", mockAssistant);

      expect(result).toBeDefined();
      expect(result?.output).toContain("Configuration service not available");
    });

    it("should use test session directory when in test mode", async () => {
      const { isAuthenticated } = await import("./auth/workos.js");
      const { services } = await import("./services/index.js");
      const { getSessionFilePath, getCurrentSession } = await import(
        "./session.js"
      );

      // Mock the session functions for this specific test
      (getSessionFilePath as any).mockReturnValue(
        "/test-home/.continue/cli-sessions/continue-cli-test-123.json",
      );
      (getCurrentSession as any).mockReturnValue({
        sessionId: "test-123",
        title: "Test Session",
      });

      (
        isAuthenticated as MockedFunction<typeof isAuthenticated>
      ).mockReturnValue(false);
      (
        services.config.getState as MockedFunction<
          typeof services.config.getState
        >
      ).mockReturnValue({
        config: null,
        configPath: undefined,
      } as ConfigServiceState);

      const result = await handleSlashCommands("/info", mockAssistant);

      expect(result?.output).toContain("Session:");
      expect(result?.output).toContain("Test Session");
      expect(result?.output).toContain("/test-home/.continue/cli-sessions/");
      expect(result?.output).toContain(".json");
    });
  });
});
