import { slugToUri } from "./uriUtils.js";
import { AuthenticatedConfig, EnvironmentAuthConfig } from "./workos-types.js";
import {
  getAccessToken,
  getAssistantSlug,
  getOrganizationId,
  isAuthenticatedConfig,
  isEnvironmentAuthConfig,
} from "./workos.js";

describe("workos utility functions", () => {
  describe("isAuthenticatedConfig", () => {
    it("should return true for authenticated config", () => {
      const config: AuthenticatedConfig = {
        userId: "user123",
        userEmail: "user@example.com",
        accessToken: "token123",
        refreshToken: "refresh123",
        expiresAt: Date.now() + 3600000,
        organizationId: "org123",
        configUri: slugToUri("assistant123"),
      };
      expect(isAuthenticatedConfig(config)).toBe(true);
    });

    it("should return false for environment auth config", () => {
      const config: EnvironmentAuthConfig = {
        accessToken: "token123",
        organizationId: null,
        configUri: slugToUri("assistant123"),
      };
      expect(isAuthenticatedConfig(config)).toBe(false);
    });

    it("should return false for null config", () => {
      expect(isAuthenticatedConfig(null)).toBe(false);
    });
  });

  describe("isEnvironmentAuthConfig", () => {
    it("should return true for environment auth config", () => {
      const config: EnvironmentAuthConfig = {
        accessToken: "token123",
        organizationId: null,
        configUri: slugToUri("assistant123"),
      };
      expect(isEnvironmentAuthConfig(config)).toBe(true);
    });

    it("should return false for authenticated config", () => {
      const config: AuthenticatedConfig = {
        userId: "user123",
        userEmail: "user@example.com",
        accessToken: "token123",
        refreshToken: "refresh123",
        expiresAt: Date.now() + 3600000,
        organizationId: "org123",
        configUri: slugToUri("assistant123"),
      };
      expect(isEnvironmentAuthConfig(config)).toBe(false);
    });

    it("should return false for null config", () => {
      expect(isEnvironmentAuthConfig(null)).toBe(false);
    });
  });

  describe("getAccessToken", () => {
    it("should return access token from authenticated config", () => {
      const config: AuthenticatedConfig = {
        userId: "user123",
        userEmail: "user@example.com",
        accessToken: "token123",
        refreshToken: "refresh123",
        expiresAt: Date.now() + 3600000,
        organizationId: "org123",
        configUri: slugToUri("assistant123"),
      };
      expect(getAccessToken(config)).toBe("token123");
    });

    it("should return access token from environment auth config", () => {
      const config: EnvironmentAuthConfig = {
        accessToken: "env-token123",
        organizationId: null,
        configUri: slugToUri("assistant123"),
      };
      expect(getAccessToken(config)).toBe("env-token123");
    });

    it("should return null for null config", () => {
      expect(getAccessToken(null)).toBe(null);
    });
  });

  describe("getOrganizationId", () => {
    it("should return organization ID from authenticated config", () => {
      const config: AuthenticatedConfig = {
        userId: "user123",
        userEmail: "user@example.com",
        accessToken: "token123",
        refreshToken: "refresh123",
        expiresAt: Date.now() + 3600000,
        organizationId: "org123",
        configUri: slugToUri("assistant123"),
      };
      expect(getOrganizationId(config)).toBe("org123");
    });

    it("should return null organization ID from authenticated config", () => {
      const config: AuthenticatedConfig = {
        userId: "user123",
        userEmail: "user@example.com",
        accessToken: "token123",
        refreshToken: "refresh123",
        expiresAt: Date.now() + 3600000,
        organizationId: null,
        configUri: slugToUri("assistant123"),
      };
      expect(getOrganizationId(config)).toBe(null);
    });

    it("should return null from environment auth config", () => {
      const config: EnvironmentAuthConfig = {
        accessToken: "env-token123",
        organizationId: null,
        configUri: slugToUri("assistant123"),
      };
      expect(getOrganizationId(config)).toBe(null);
    });

    it("should return null for null config", () => {
      expect(getOrganizationId(null)).toBe(null);
    });
  });

  describe("getAssistantSlug", () => {
    it("should return assistant slug from authenticated config", () => {
      const config: AuthenticatedConfig = {
        userId: "user123",
        userEmail: "user@example.com",
        accessToken: "token123",
        refreshToken: "refresh123",
        expiresAt: Date.now() + 3600000,
        organizationId: "org123",
        configUri: slugToUri("assistant123"),
      };
      expect(getAssistantSlug(config)).toBe("assistant123");
    });

    it("should return null when assistant slug is undefined in authenticated config", () => {
      const config: AuthenticatedConfig = {
        userId: "user123",
        userEmail: "user@example.com",
        accessToken: "token123",
        refreshToken: "refresh123",
        expiresAt: Date.now() + 3600000,
        organizationId: "org123",
        configUri: undefined,
      };
      expect(getAssistantSlug(config)).toBe(null);
    });

    it("should return assistant slug from environment auth config", () => {
      const config: EnvironmentAuthConfig = {
        accessToken: "env-token123",
        organizationId: null,
        configUri: slugToUri("env-assistant123"),
      };
      expect(getAssistantSlug(config)).toBe("env-assistant123");
    });

    it("should return null when assistant slug is undefined in environment auth config", () => {
      const config: EnvironmentAuthConfig = {
        accessToken: "env-token123",
        organizationId: null,
        configUri: undefined,
      };
      expect(getAssistantSlug(config)).toBe(null);
    });

    it("should return null for null config", () => {
      expect(getAssistantSlug(null)).toBe(null);
    });
  });
});
