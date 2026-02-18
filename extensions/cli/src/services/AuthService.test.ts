import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the workos module
vi.mock("../auth/workos.js");

// Import the workos functions we need to mock
import {
  ensureOrganization,
  isAuthenticated,
  listUserOrganizations,
  loadAuthConfig,
  login,
  logout,
  saveAuthConfig,
} from "../auth/workos.js";

import { AuthService } from "./AuthService.js";

describe("AuthService", () => {
  let service: AuthService;
  const mockAuthConfig = {
    accessToken: "test-token",
    organizationId: "org-123",
    userId: "user-123",
    userEmail: "test@example.com",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  describe("State Management", () => {
    test("should initialize with unauthenticated state", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticated).mockResolvedValue(false);

      const state = await service.initialize();

      expect(state).toEqual({
        authConfig: null,
        isAuthenticated: false,
        organizationId: undefined,
      });
    });

    test("should initialize with authenticated state", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);

      const state = await service.initialize();

      expect(state).toEqual({
        authConfig: mockAuthConfig,
        isAuthenticated: true,
        organizationId: "org-123",
      });
    });
  });

  describe("login()", () => {
    test("should update state after successful login", async () => {
      // Initialize first
      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticated).mockResolvedValue(false);
      await service.initialize();

      // Mock successful login
      vi.mocked(login).mockResolvedValue(mockAuthConfig);

      const state = await service.login();

      expect(state).toEqual({
        authConfig: mockAuthConfig,
        isAuthenticated: true,
        organizationId: "org-123",
      });
      expect(service.getState()).toEqual(state);
    });

    test("should handle login failure", async () => {
      await service.initialize();
      const loginError = new Error("Login failed");
      vi.mocked(login).mockRejectedValue(loginError);

      await expect(service.login()).rejects.toThrow("Login failed");
    });
  });

  describe("logout()", () => {
    test("should clear state after logout", async () => {
      // Initialize with authenticated state
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      const state = await service.logout();

      expect(state).toEqual({
        authConfig: null,
        isAuthenticated: false,
        organizationId: undefined,
      });
      expect(logout).toHaveBeenCalled();
    });
  });

  describe("ensureOrganization()", () => {
    test("should update organization after ensuring", async () => {
      // Initialize with auth but no org
      const authWithoutOrg = { ...mockAuthConfig, organizationId: null };
      vi.mocked(loadAuthConfig).mockReturnValue(authWithoutOrg);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      // Mock ensure organization
      vi.mocked(ensureOrganization).mockResolvedValue(mockAuthConfig);

      const state = await service.ensureOrganization();

      expect(state).toEqual({
        authConfig: mockAuthConfig,
        isAuthenticated: true,
        organizationId: "org-123",
      });
    });

    test("should throw error if not authenticated", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticated).mockResolvedValue(false);
      await service.initialize();

      await expect(service.ensureOrganization()).rejects.toThrow(
        "Not authenticated - cannot ensure organization",
      );
    });

    test("should pass organization slug to ensureOrganization in headless mode", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      const updatedConfig = { ...mockAuthConfig, organizationId: "org-456" };
      vi.mocked(ensureOrganization).mockResolvedValue(updatedConfig);

      const state = await service.ensureOrganization(true, "org-slug");

      expect(ensureOrganization).toHaveBeenCalledWith(
        mockAuthConfig,
        true,
        "org-slug",
      );
      expect(state).toEqual({
        authConfig: updatedConfig,
        isAuthenticated: true,
        organizationId: "org-456",
      });
    });

    test("should handle personal organization slug", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      const personalConfig = { ...mockAuthConfig, organizationId: null };
      vi.mocked(ensureOrganization).mockResolvedValue(personalConfig);

      const state = await service.ensureOrganization(true, "personal");

      expect(ensureOrganization).toHaveBeenCalledWith(
        mockAuthConfig,
        true,
        "personal",
      );
      expect(state).toEqual({
        authConfig: personalConfig,
        isAuthenticated: true,
        organizationId: undefined,
      });
    });

    test("should work without organization slug parameter", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      vi.mocked(ensureOrganization).mockResolvedValue(mockAuthConfig);

      const state = await service.ensureOrganization(false);

      expect(ensureOrganization).toHaveBeenCalledWith(
        mockAuthConfig,
        false,
        undefined,
      );
      expect(state).toEqual({
        authConfig: mockAuthConfig,
        isAuthenticated: true,
        organizationId: "org-123",
      });
    });
  });

  describe("switchOrganization()", () => {
    test("should update state with new organization", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      const state = await service.switchOrganization("org-456");

      expect(state).toEqual({
        authConfig: {
          ...mockAuthConfig,
          organizationId: "org-456",
        },
        isAuthenticated: true,
        organizationId: "org-456",
      });
      expect(saveAuthConfig).toHaveBeenCalledWith({
        ...mockAuthConfig,
        organizationId: "org-456",
      });
    });

    test("should handle null organization", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      const state = await service.switchOrganization(null);

      expect(state.organizationId).toBeUndefined();
    });

    test("should throw error if not file-based auth", async () => {
      const tokenOnlyAuth = { accessToken: "token" } as any;
      vi.mocked(loadAuthConfig).mockReturnValue(tokenOnlyAuth);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      await expect(service.switchOrganization("org-456")).rejects.toThrow(
        "Not authenticated with file-based auth",
      );
    });
  });

  describe("getAvailableOrganizations()", () => {
    test("should return organizations when authenticated", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      const mockOrgs = [
        { id: "org-1", name: "Org 1", slug: "org-1" },
        { id: "org-2", name: "Org 2", slug: "org-2" },
      ];
      vi.mocked(listUserOrganizations).mockResolvedValue(mockOrgs);

      const orgs = await service.getAvailableOrganizations();
      expect(orgs).toEqual(mockOrgs);
    });

    test("should return null when not authenticated", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticated).mockResolvedValue(false);
      await service.initialize();

      const orgs = await service.getAvailableOrganizations();
      expect(orgs).toBeNull();
    });

    test("should handle errors gracefully", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      vi.mocked(listUserOrganizations).mockRejectedValue(
        new Error("API error"),
      );

      // Add error event listener to prevent unhandled rejection
      const errorHandler = vi.fn();
      service.on("error", errorHandler);

      const orgs = await service.getAvailableOrganizations();
      expect(orgs).toBeNull();
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));

      // Clean up
      service.off("error", errorHandler);
    });
  });

  describe("hasMultipleOrganizations()", () => {
    test("should return true when multiple orgs available", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      vi.mocked(listUserOrganizations).mockResolvedValue([
        { id: "org-1", name: "Org 1", slug: "org-1" },
        { id: "org-2", name: "Org 2", slug: "org-2" },
      ]);

      const hasMultiple = await service.hasMultipleOrganizations();
      expect(hasMultiple).toBe(true);
    });

    test("should return false when no orgs available", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      await service.initialize();

      vi.mocked(listUserOrganizations).mockResolvedValue([]);

      const hasMultiple = await service.hasMultipleOrganizations();
      expect(hasMultiple).toBe(false);
    });
  });

  describe("refresh()", () => {
    test("should reload auth state from disk", async () => {
      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticated).mockResolvedValue(false);
      await service.initialize();

      // Update mock to return authenticated state
      vi.mocked(loadAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(isAuthenticated).mockResolvedValue(true);

      const state = await service.refresh();

      expect(state).toEqual({
        authConfig: mockAuthConfig,
        isAuthenticated: true,
        organizationId: "org-123",
      });
    });
  });

  describe("Event Emission", () => {
    test("should emit stateChanged on login", async () => {
      // Initialize with no auth config to simulate logged out state
      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticated).mockResolvedValue(false);
      await service.initialize();

      const listener = vi.fn();
      service.on("stateChanged", listener);

      vi.mocked(login).mockResolvedValue(mockAuthConfig);
      await service.login();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          authConfig: mockAuthConfig,
          organizationId: "org-123",
        }),
        expect.objectContaining({
          isAuthenticated: false,
          authConfig: null,
        }),
      );
    });

    test("should emit error on login failure", async () => {
      await service.initialize();
      const errorListener = vi.fn();
      service.on("error", errorListener);

      const error = new Error("Login failed");
      vi.mocked(login).mockRejectedValue(error);

      await expect(service.login()).rejects.toThrow();
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });
});
