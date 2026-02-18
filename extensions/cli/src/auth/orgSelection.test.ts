import * as fs from "fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  autoSelectOrganizationAndConfig,
  createUpdatedAuthConfig,
} from "./orgSelection.js";
import { AuthenticatedConfig } from "./workos-types.js";

// Mock dependencies
vi.mock("fs");
vi.mock("../config.js");
vi.mock("../env.js");
vi.mock("./workos.js");

const mockApiClient = {
  listOrganizations: vi.fn(),
  listAssistants: vi.fn(),
} as any; // Mock API client for testing

describe("orgSelection", () => {
  const mockConfig: AuthenticatedConfig = {
    userId: "user123",
    userEmail: "user@example.com",
    accessToken: "token123",
    refreshToken: "refresh123",
    expiresAt: Date.now() + 3600000,
    organizationId: undefined,
    configUri: undefined,
    modelName: undefined,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock modules using vi.mocked
    const configMod = await import("../config.js");
    const envMod = await import("../env.js");
    const workosMod = await import("./workos.js");

    vi.mocked(configMod.getApiClient).mockReturnValue(mockApiClient);
    vi.mocked(envMod.env).continueHome = "/mock/home";
    vi.mocked(workosMod.saveAuthConfig).mockImplementation(() => {});

    // Default: no local config
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  describe("createUpdatedAuthConfig", () => {
    it("should update organization ID", () => {
      const result = createUpdatedAuthConfig(mockConfig, "org123");
      expect(result.organizationId).toBe("org123");
    });

    it("should update organization ID and config URI", () => {
      const result = createUpdatedAuthConfig(
        mockConfig,
        "org123",
        "slug://owner/assistant",
      );
      expect(result.organizationId).toBe("org123");
      expect(result!.configUri).toBe("slug://owner/assistant");
    });

    it("should set personal organization", () => {
      const result = createUpdatedAuthConfig(mockConfig, null);
      expect(result.organizationId).toBe(null);
    });
  });

  describe("autoSelectOrganizationAndConfig scenarios", () => {
    it("Priority 1: Org with assistants → select first assistant", async () => {
      mockApiClient.listOrganizations.mockResolvedValue({
        organizations: [
          { id: "org1", name: "Org 1" },
          { id: "org2", name: "Org 2" },
        ],
      });

      // Mock API calls in order: org1 assistants, org2 assistants
      mockApiClient.listAssistants.mockImplementation(
        ({ organizationId }: { organizationId?: string }) => {
          if (organizationId === "org1") return Promise.resolve([]);
          if (organizationId === "org2")
            return Promise.resolve([
              { ownerSlug: "owner", packageSlug: "assistant1" },
            ]);
          return Promise.resolve([]);
        },
      );

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe("org2");
      expect(result!.configUri).toBe("slug://owner/assistant1");
    });

    it("Priority 2: No org assistants → personal assistants exist", async () => {
      mockApiClient.listOrganizations.mockResolvedValue({
        organizations: [{ id: "org1", name: "Org 1" }],
      });

      mockApiClient.listAssistants.mockImplementation(
        ({ organizationId }: { organizationId?: string }) => {
          if (organizationId === "org1") return Promise.resolve([]);
          if (organizationId === undefined)
            return Promise.resolve([
              { ownerSlug: "personal", packageSlug: "my-assistant" },
            ]);
          return Promise.resolve([]);
        },
      );

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe(null); // personal org
      expect(result!.configUri).toBe("slug://personal/my-assistant");
      expect(mockApiClient.listAssistants).toHaveBeenCalledWith({
        organizationId: undefined,
      });
    });

    it("Priority 3: No assistants anywhere → local config.yaml exists", async () => {
      mockApiClient.listOrganizations.mockResolvedValue({
        organizations: [{ id: "org1", name: "Org 1" }],
      });

      mockApiClient.listAssistants.mockResolvedValue([]); // No assistants anywhere
      vi.mocked(fs.existsSync).mockReturnValue(true); // config.yaml exists

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe(null);
      expect(result!.configUri).toContain("config.yaml");
    });

    it("Priority 4: No assistants, no config.yaml → fallback", async () => {
      mockApiClient.listOrganizations.mockResolvedValue({
        organizations: [{ id: "org1", name: "Org 1" }],
      });

      mockApiClient.listAssistants.mockResolvedValue([]); // No assistants anywhere
      vi.mocked(fs.existsSync).mockReturnValue(false); // No config.yaml

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe(null);
      expect(result!.configUri).toBeUndefined();
    });

    it("Multiple orgs with assistants → pick first one", async () => {
      mockApiClient.listOrganizations.mockResolvedValue({
        organizations: [
          { id: "org1", name: "Org 1" },
          { id: "org2", name: "Org 2" },
        ],
      });

      mockApiClient.listAssistants.mockImplementation(
        ({ organizationId }: { organizationId?: string }) => {
          if (organizationId === "org1")
            return Promise.resolve([
              { ownerSlug: "owner1", packageSlug: "assistant1" },
            ]);
          if (organizationId === "org2")
            return Promise.resolve([
              { ownerSlug: "owner2", packageSlug: "assistant2" },
            ]);
          return Promise.resolve([]);
        },
      );

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe("org1"); // First org wins
      expect(result!.configUri).toBe("slug://owner1/assistant1");
    });

    it("Personal assistants API fails → fallback to config.yaml", async () => {
      mockApiClient.listOrganizations.mockResolvedValue({
        organizations: [{ id: "org1", name: "Org 1" }],
      });

      mockApiClient.listAssistants
        .mockResolvedValueOnce([]) // org1: no assistants
        .mockRejectedValueOnce(new Error("Personal API failed")); // personal: API error

      vi.mocked(fs.existsSync).mockReturnValue(true); // config.yaml exists

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe(null);
      expect(result!.configUri).toContain("config.yaml");
    });

    it("Empty organizations list → check personal assistants", async () => {
      mockApiClient.listOrganizations.mockResolvedValue({
        organizations: [], // No orgs
      });

      mockApiClient.listAssistants.mockResolvedValue([
        { ownerSlug: "personal", packageSlug: "my-assistant" },
      ]);

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe(null);
      expect(result!.configUri).toBe("slug://personal/my-assistant");
    });

    it("API error → fallback with error message", async () => {
      mockApiClient.listOrganizations.mockRejectedValue(
        new Error("Network error"),
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await autoSelectOrganizationAndConfig(mockConfig);

      expect(result!.organizationId).toBe(null);
      expect(result!.configUri).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching organizations:"),
        "Network error",
      );

      consoleSpy.mockRestore();
    });
  });
});
