import * as fs from "node:fs";

import { FQSN, SecretResult, SecretType } from "@continuedev/config-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLIPlatformClient } from "./CLIPlatformClient.js";

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock env module
vi.mock("./env.js", () => ({
  env: {
    continueHome: "/home/user/.continue",
  },
}));

describe("CLIPlatformClient", () => {
  let mockApiClient: {
    syncSecrets: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockApiClient = {
      syncSecrets: vi.fn(),
    };
    // Reset process.env mocks
    vi.unstubAllEnvs();
  });

  describe("resolveFQSNs", () => {
    it("returns empty array for empty input", async () => {
      const client = new CLIPlatformClient(null, mockApiClient as any);
      const results = await client.resolveFQSNs([]);
      expect(results).toEqual([]);
      expect(mockApiClient.syncSecrets).not.toHaveBeenCalled();
    });

    it("prioritizes local env over API results", async () => {
      const fqsn: FQSN = {
        packageSlugs: [
          { ownerSlug: "anthropic", packageSlug: "claude-sonnet" },
        ],
        secretName: "ANTHROPIC_API_KEY",
      };

      // Local env has the secret
      vi.stubEnv("ANTHROPIC_API_KEY", "local-api-key");

      const client = new CLIPlatformClient("org-123", mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      // Should not call API since local env has the secret
      expect(mockApiClient.syncSecrets).not.toHaveBeenCalled();

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        found: true,
        value: "local-api-key",
        secretLocation: {
          secretType: SecretType.LocalEnv,
          secretName: "ANTHROPIC_API_KEY",
        },
      });
    });

    it("falls back to API when local env does not have the secret", async () => {
      const fqsn: FQSN = {
        packageSlugs: [
          { ownerSlug: "anthropic", packageSlug: "claude-sonnet" },
        ],
        secretName: "ANTHROPIC_API_KEY",
      };

      // Ensure no local env secret exists
      vi.stubEnv("ANTHROPIC_API_KEY", undefined as unknown as string);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // API returns a user secret with value
      const apiResult: SecretResult = {
        found: true,
        fqsn,
        value: "api-secret-value",
        secretLocation: {
          secretType: SecretType.User,
          userSlug: "testuser",
          secretName: "ANTHROPIC_API_KEY",
        },
      };
      mockApiClient.syncSecrets.mockResolvedValue([apiResult]);

      const client = new CLIPlatformClient("org-123", mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      expect(mockApiClient.syncSecrets).toHaveBeenCalledWith({
        syncSecretsRequest: {
          fqsns: [fqsn],
          orgScopeId: "org-123",
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(apiResult);
    });

    it("keeps API results with secretLocation but no value (models_add_on)", async () => {
      const fqsn: FQSN = {
        packageSlugs: [
          { ownerSlug: "anthropic", packageSlug: "claude-sonnet" },
        ],
        secretName: "ANTHROPIC_API_KEY",
      };

      // Ensure no local env secret exists
      vi.stubEnv("ANTHROPIC_API_KEY", undefined as unknown as string);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // API returns a models_add_on result (has secretLocation but no value)
      const apiResult: SecretResult = {
        found: true,
        fqsn,
        secretLocation: {
          secretType: SecretType.ModelsAddOn,
          blockSlug: { ownerSlug: "anthropic", packageSlug: "claude-sonnet" },
          secretName: "ANTHROPIC_API_KEY",
        },
      };
      mockApiClient.syncSecrets.mockResolvedValue([apiResult]);

      const client = new CLIPlatformClient("org-123", mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      expect(results).toHaveLength(1);
      // The result should be kept even though it has no value
      expect(results[0]).toEqual(apiResult);
      expect(results[0]).not.toHaveProperty("value");
      expect((results[0] as any).secretLocation.secretType).toBe(
        SecretType.ModelsAddOn,
      );
    });

    it("keeps API results with secretLocation but no value (free_trial)", async () => {
      const fqsn: FQSN = {
        packageSlugs: [{ ownerSlug: "openai", packageSlug: "gpt-4" }],
        secretName: "OPENAI_API_KEY",
      };

      // Ensure no local env secret exists
      vi.stubEnv("OPENAI_API_KEY", undefined as unknown as string);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // API returns a free_trial result
      const apiResult: SecretResult = {
        found: true,
        fqsn,
        secretLocation: {
          secretType: SecretType.FreeTrial,
          blockSlug: { ownerSlug: "openai", packageSlug: "gpt-4" },
          secretName: "OPENAI_API_KEY",
        },
      };
      mockApiClient.syncSecrets.mockResolvedValue([apiResult]);

      const client = new CLIPlatformClient(null, mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(apiResult);
      expect((results[0] as any).secretLocation.secretType).toBe(
        SecretType.FreeTrial,
      );
    });

    it("handles mixed results - some local, some from API", async () => {
      const fqsn1: FQSN = {
        packageSlugs: [
          { ownerSlug: "anthropic", packageSlug: "claude-sonnet" },
        ],
        secretName: "ANTHROPIC_API_KEY",
      };
      const fqsn2: FQSN = {
        packageSlugs: [{ ownerSlug: "openai", packageSlug: "gpt-4" }],
        secretName: "OPENAI_API_KEY",
      };

      // First secret is in local env
      vi.stubEnv("ANTHROPIC_API_KEY", "local-anthropic-key");
      // Ensure second secret is not in local env
      vi.stubEnv("OPENAI_API_KEY", undefined as unknown as string);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // API returns models_add_on for the second secret
      const apiResult: SecretResult = {
        found: true,
        fqsn: fqsn2,
        secretLocation: {
          secretType: SecretType.ModelsAddOn,
          blockSlug: { ownerSlug: "openai", packageSlug: "gpt-4" },
          secretName: "OPENAI_API_KEY",
        },
      };
      mockApiClient.syncSecrets.mockResolvedValue([apiResult]);

      const client = new CLIPlatformClient("org-123", mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn1, fqsn2]);

      // API should only be called for the unresolved secret
      expect(mockApiClient.syncSecrets).toHaveBeenCalledWith({
        syncSecretsRequest: {
          fqsns: [fqsn2], // Only fqsn2 should be sent to API
          orgScopeId: "org-123",
        },
      });

      expect(results).toHaveLength(2);

      // First result from local env
      expect(results[0]).toMatchObject({
        found: true,
        value: "local-anthropic-key",
        secretLocation: {
          secretType: SecretType.LocalEnv,
        },
      });

      // Second result from API (models_add_on, no value)
      expect(results[1]).toEqual(apiResult);
    });

    it("handles API errors gracefully", async () => {
      const fqsn: FQSN = {
        packageSlugs: [{ ownerSlug: "test", packageSlug: "model" }],
        secretName: "API_KEY",
      };

      // No local env secret
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // API throws an error
      mockApiClient.syncSecrets.mockRejectedValue(new Error("Network error"));

      const client = new CLIPlatformClient(null, mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      // Should return undefined for the unresolved secret
      expect(results).toHaveLength(1);
      expect(results[0]).toBeUndefined();
    });

    it("does not call API when all secrets are found locally", async () => {
      const fqsn1: FQSN = {
        packageSlugs: [],
        secretName: "SECRET_1",
      };
      const fqsn2: FQSN = {
        packageSlugs: [],
        secretName: "SECRET_2",
      };

      // Both secrets are in local env
      vi.stubEnv("SECRET_1", "value1");
      vi.stubEnv("SECRET_2", "value2");

      const client = new CLIPlatformClient(null, mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn1, fqsn2]);

      // API should not be called at all
      expect(mockApiClient.syncSecrets).not.toHaveBeenCalled();

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ found: true, value: "value1" });
      expect(results[1]).toMatchObject({ found: true, value: "value2" });
    });

    it("returns undefined for secrets not found anywhere", async () => {
      const fqsn: FQSN = {
        packageSlugs: [{ ownerSlug: "unknown", packageSlug: "model" }],
        secretName: "UNKNOWN_KEY",
      };

      // No local env secret
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // API returns not found
      const apiResult: SecretResult = {
        found: false,
        fqsn,
        secretLocation: {
          secretType: SecretType.NotFound,
          secretName: "UNKNOWN_KEY",
        },
      };
      mockApiClient.syncSecrets.mockResolvedValue([apiResult]);

      const client = new CLIPlatformClient(null, mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      expect(results).toHaveLength(1);
      // Not found results should not be kept (found: false)
      expect(results[0]).toBeUndefined();
    });

    it("resolves secrets from process.env with file-based FQSN format (empty package slugs)", async () => {
      // This tests the FQSN format used for slug injected blocks
      // e.g., ${{ secrets.//ANTHROPIC_API_KEY }} which decodes to:
      // { packageSlugs: [{ ownerSlug: "", packageSlug: "" }], secretName: "ANTHROPIC_API_KEY" }
      const fqsn: FQSN = {
        packageSlugs: [{ ownerSlug: "", packageSlug: "" }],
        secretName: "ANTHROPIC_API_KEY",
      };

      // Secret is in process.env
      vi.stubEnv("ANTHROPIC_API_KEY", "my-local-api-key");

      const client = new CLIPlatformClient(null, mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      // Should not call API since local env has the secret
      expect(mockApiClient.syncSecrets).not.toHaveBeenCalled();

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        found: true,
        value: "my-local-api-key",
        fqsn: {
          packageSlugs: [{ ownerSlug: "", packageSlug: "" }],
          secretName: "ANTHROPIC_API_KEY",
        },
        secretLocation: {
          secretType: SecretType.LocalEnv,
          secretName: "ANTHROPIC_API_KEY",
        },
      });
    });

    it("falls back to API for file-based FQSN when not in local env", async () => {
      // File-based FQSN with empty package slugs
      const fqsn: FQSN = {
        packageSlugs: [{ ownerSlug: "", packageSlug: "" }],
        secretName: "OPENAI_API_KEY",
      };

      // Ensure no local env secret exists
      vi.stubEnv("OPENAI_API_KEY", undefined as unknown as string);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // API returns models_add_on (the server can still resolve this)
      const apiResult: SecretResult = {
        found: true,
        fqsn,
        secretLocation: {
          secretType: SecretType.ModelsAddOn,
          blockSlug: { ownerSlug: "", packageSlug: "" },
          secretName: "OPENAI_API_KEY",
        },
      };
      mockApiClient.syncSecrets.mockResolvedValue([apiResult]);

      const client = new CLIPlatformClient("org-123", mockApiClient as any);
      const results = await client.resolveFQSNs([fqsn]);

      expect(mockApiClient.syncSecrets).toHaveBeenCalledWith({
        syncSecretsRequest: {
          fqsns: [fqsn],
          orgScopeId: "org-123",
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(apiResult);
    });
  });
});
