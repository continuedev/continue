// Import after mocking
import { AssistantUnrolled } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, vi, test } from "vitest";

import * as workos from "./auth/workos.js";
import * as commands from "./commands/commands.js";
import { reloadService, SERVICE_NAMES, services } from "./services/index.js";
import type { AuthServiceState } from "./services/types.js";
import { handleSlashCommands } from "./slashCommands.js";

// The imports are already mocked via vitest.setup.ts, so we can use them directly

// Mock console to avoid output during tests
const originalConsole = console;
const mockConsole = {
  info: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};

describe("handleSlashCommands", () => {
  const mockAssistant: AssistantUnrolled = {
    name: "test-assistant",
    version: "1.0.0",
    prompts: [{ name: "test", prompt: "Test prompt: " }],
  };

  beforeEach(() => {
    Object.assign(console, mockConsole);
    vi.clearAllMocks();

    // Since the mock already returns the required value, we don't need to set it
    // Just verify it returns what we expect
    expect(commands.getAllSlashCommands(mockAssistant)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "help" }),
        expect.objectContaining({ name: "login" }),
      ])
    );
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  describe("Automatic Service Cascade Reloading", () => {
    test.skip("login command should trigger automatic cascade reload via auth service", async () => {
      const newAuthState: AuthServiceState = {
        authConfig: { userEmail: "test@example.com" } as any,
        isAuthenticated: true,
      };

      (services.auth.login as any).mockResolvedValue(newAuthState);
      (workos.isAuthenticatedConfig as any).mockReturnValue(true);
      (reloadService as any).mockResolvedValue(undefined);

      const result = await handleSlashCommands("/login", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain(
        "Login successful! All services updated automatically."
      );

      // Verify auth service login was called
      expect(services.auth.login).toHaveBeenCalledTimes(1);

      // Verify automatic cascade reload was triggered - only auth service reload needed
      expect(reloadService).toHaveBeenCalledTimes(1);
      expect(reloadService).toHaveBeenCalledWith(SERVICE_NAMES.AUTH);

      // Verify manual service reloads are NOT called
      expect(reloadService).not.toHaveBeenCalledWith(SERVICE_NAMES.API_CLIENT);
      expect(reloadService).not.toHaveBeenCalledWith(SERVICE_NAMES.CONFIG);
    });

    test.skip("org switch command should trigger automatic cascade reload via auth service", async () => {
      const newOrgState: AuthServiceState = {
        authConfig: { userEmail: "test@example.com" } as any,
        isAuthenticated: true,
        organizationId: "new-org",
      };
      (services.auth.switchOrganization as any).mockResolvedValue(newOrgState);
      (reloadService as any).mockResolvedValue(undefined);

      const result = await handleSlashCommands("/org test-org", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain(
        "Switched to organization: test-org. All services updated automatically."
      );

      // Verify organization switch was called
      expect(services.auth.switchOrganization).toHaveBeenCalledWith("test-org");

      // Verify automatic cascade reload was triggered - only auth service reload needed
      expect(reloadService).toHaveBeenCalledTimes(1);
      expect(reloadService).toHaveBeenCalledWith(SERVICE_NAMES.AUTH);

      // Verify manual service reloads are NOT called
      expect(reloadService).not.toHaveBeenCalledWith(SERVICE_NAMES.CONFIG);
      expect(reloadService).not.toHaveBeenCalledWith(SERVICE_NAMES.MODEL);
      expect(reloadService).not.toHaveBeenCalledWith(SERVICE_NAMES.MCP);
    });

    test.skip("org list command should not trigger any reloads", async () => {
      const mockOrgs = [
        { id: "org1", name: "Organization 1" },
        { id: "org2", name: "Organization 2" },
      ];

      (services.auth.getAvailableOrganizations as any).mockResolvedValue(
        mockOrgs
      );

      const result = await handleSlashCommands("/org list", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain("Available organizations:");
      expect(result?.output).toContain("org1: Organization 1");
      expect(result?.output).toContain("org2: Organization 2");

      // Verify NO reload was triggered
      expect(reloadService).not.toHaveBeenCalled();
    });

    test.skip("login failure should not trigger any reloads", async () => {
      const loginError = new Error("Login failed");
      (services.auth.login as any).mockRejectedValue(loginError);

      const result = await handleSlashCommands("/login", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain("Login failed: Login failed");

      // Verify NO reload was triggered on failure
      expect(reloadService).not.toHaveBeenCalled();
    });

    test.skip("org switch failure should not trigger any reloads", async () => {
      const switchError = new Error("Organization switch failed");
      (services.auth.switchOrganization as any).mockRejectedValue(switchError);

      const result = await handleSlashCommands(
        "/org invalid-org",
        mockAssistant
      );

      expect(result).not.toBeNull();
      expect(result?.output).toContain(
        "Failed to switch organization: Organization switch failed"
      );

      // Verify NO reload was triggered on failure
      expect(reloadService).not.toHaveBeenCalled();
    });
  });

  describe("Other Commands (unchanged behavior)", () => {
    test("help command should work normally", async () => {
      const result = await handleSlashCommands("/help", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain("Slash commands:");
      expect(result?.output).toContain("/help: Show help");
      expect(result?.output).toContain("/login: Authenticate");
    });

    test.skip("logout command should exit", async () => {
      const logoutState: AuthServiceState = {
        authConfig: null,
        isAuthenticated: false,
      };
      (services.auth.logout as any).mockResolvedValue(logoutState);

      const result = await handleSlashCommands("/logout", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.exit).toBe(true);
      expect(result?.output).toContain("Logged out successfully");
    });

    test("clear command should work normally", async () => {
      const result = await handleSlashCommands("/clear", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.clear).toBe(true);
      expect(result?.output).toBe("Chat history cleared");
    });

    test("compact command should work normally", async () => {
      const result = await handleSlashCommands("/compact", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.compact).toBe(true);
    });

    test("non-slash input should return null", async () => {
      const result = await handleSlashCommands("regular input", mockAssistant);
      expect(result).toBeNull();
    });

    test("unknown slash command should return error", async () => {
      const result = await handleSlashCommands("/unknown", mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toBe("Unknown command: unknown");
    });
  });
});
