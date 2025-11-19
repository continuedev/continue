import chalk from "chalk";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getApiClient } from "../config.js";

import { AuthenticatedConfig, EnvironmentAuthConfig } from "./workos-types.js";
import { ensureOrganization } from "./workos.js";

// Mock dependencies
vi.mock("../config.js", () => ({
  getApiClient: vi.fn(() => ({
    listOrganizations: vi.fn(),
  })),
}));

vi.mock("../init.js", () => ({
  safeStderr: vi.fn(),
}));

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

describe("ensureOrganization with CLI organization slug", () => {
  const mockAuthConfig: AuthenticatedConfig = {
    userId: "user-123",
    userEmail: "test@example.com",
    accessToken: "test-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 3600000,
    organizationId: null,
  };

  const mockEnvAuthConfig: EnvironmentAuthConfig = {
    accessToken: "env-token",
    organizationId: null,
  };

  const mockOrganizations = [
    { id: "org-1", name: "Organization One", slug: "org-one" },
    { id: "org-2", name: "Organization Two", slug: "org-two" },
    { id: "org-3", name: "Test Org", slug: "test-org" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  describe("Organization resolution by slug", () => {
    test("should resolve organization by exact slug match", async () => {
      const apiClient = {
        listOrganizations: vi
          .fn()
          .mockResolvedValue({ organizations: mockOrganizations }),
      };
      vi.mocked(getApiClient).mockReturnValue(apiClient as any);

      const result = await ensureOrganization(mockAuthConfig, true, "org-one");

      expect(result).toMatchObject({
        organizationId: "org-1",
      });
      expect(apiClient.listOrganizations).toHaveBeenCalled();
    });

    test("should show available organizations when slug not found", async () => {
      const apiClient = {
        listOrganizations: vi
          .fn()
          .mockResolvedValue({ organizations: mockOrganizations }),
      };
      vi.mocked(getApiClient).mockReturnValue(apiClient as any);

      const consoleInfoSpy = vi.spyOn(console, "info");

      await expect(
        ensureOrganization(mockAuthConfig, true, "invalid-org"),
      ).rejects.toThrow('Organization "invalid-org" not found');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        chalk.yellow("Available organizations:"),
        expect.stringContaining("personal"),
      );
    });
  });

  describe("Mode restriction", () => {
    test("should reject --org flag in interactive mode", async () => {
      const { safeStderr } = await import("../init.js");
      const safeStderrSpy = vi.mocked(safeStderr);
      const processExitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => {
          throw new Error("Process exit");
        });

      await expect(
        ensureOrganization(mockAuthConfig, false, "org-one"),
      ).rejects.toThrow("Process exit");

      expect(safeStderrSpy).toHaveBeenCalledWith(
        chalk.red(
          "The --org flag is only supported in headless mode (with -p/--print flag)\n",
        ),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
    });
  });

  describe("Auth type handling", () => {
    test("should work with authenticated config and return updated organizationId", async () => {
      const apiClient = {
        listOrganizations: vi
          .fn()
          .mockResolvedValue({ organizations: mockOrganizations }),
      };
      vi.mocked(getApiClient).mockReturnValue(apiClient as any);

      const result = await ensureOrganization(mockAuthConfig, true, "test-org");

      expect(result).toMatchObject({
        userId: "user-123",
        organizationId: "org-3",
      });
    });

    test("should work with environment auth config and return updated organizationId", async () => {
      const apiClient = {
        listOrganizations: vi
          .fn()
          .mockResolvedValue({ organizations: mockOrganizations }),
      };
      vi.mocked(getApiClient).mockReturnValue(apiClient as any);

      const result = await ensureOrganization(
        mockEnvAuthConfig,
        true,
        "org-two",
      );

      expect(result).toMatchObject({
        accessToken: "env-token",
        organizationId: "org-2",
      });
    });

    test("should override existing organization with CLI slug", async () => {
      const authWithOrg = {
        ...mockAuthConfig,
        organizationId: "existing-org",
      };

      const apiClient = {
        listOrganizations: vi
          .fn()
          .mockResolvedValue({ organizations: mockOrganizations }),
      };
      vi.mocked(getApiClient).mockReturnValue(apiClient as any);

      const result = await ensureOrganization(authWithOrg, true, "org-one");

      expect(result).toMatchObject({
        organizationId: "org-1",
      });
    });

    test("should keep existing organization when no slug provided", async () => {
      const authWithOrg = {
        ...mockAuthConfig,
        organizationId: "existing-org",
      };

      const result = await ensureOrganization(authWithOrg, true);

      expect(result).toMatchObject({
        organizationId: "existing-org",
      });
    });
  });

  describe("Error handling", () => {
    test("should handle API errors during organization fetch", async () => {
      const apiClient = {
        listOrganizations: vi.fn().mockRejectedValue(new Error("API Error")),
      };
      vi.mocked(getApiClient).mockReturnValue(apiClient as any);

      await expect(
        ensureOrganization(mockAuthConfig, true, "org-one"),
      ).rejects.toThrow("API Error");
    });
  });
});
