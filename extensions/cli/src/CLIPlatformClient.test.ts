import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  FQSN,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api";

import { CLIPlatformClient } from "./CLIPlatformClient.js";

// Mock dependencies
vi.mock("node:fs");
vi.mock("./env.js", () => ({
  env: {
    continueHome: "/home/user/.continue",
  },
}));

describe("CLIPlatformClient", () => {
  let mockApiClient: DefaultApiInterface;
  let platformClient: CLIPlatformClient;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    mockApiClient = {
      syncSecrets: vi.fn(),
    } as unknown as DefaultApiInterface;

    platformClient = new CLIPlatformClient("test-org-id", mockApiClient);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("resolveFQSNs - local fallback behavior", () => {
    test("should fallback to process.env when API returns not found", async () => {
      const fqsns: FQSN[] = [
        { secretName: "ANTHROPIC_API_KEY", ownerSlug: null, packageSlug: null },
      ];

      // Set the secret in process.env
      process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";

      // Mock API returning found: false
      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        { found: false, fqsn: fqsns[0] },
      ]);

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        found: true,
        fqsn: fqsns[0],
        value: "sk-ant-test-key",
        secretLocation: {
          secretName: "ANTHROPIC_API_KEY",
          secretType: SecretType.ProcessEnv,
        },
      });
    });

    test("should fallback to local sources when API call fails", async () => {
      const fqsns: FQSN[] = [
        { secretName: "OPENAI_API_KEY", ownerSlug: null, packageSlug: null },
      ];

      process.env.OPENAI_API_KEY = "sk-test-key";

      // Mock API throwing an error
      vi.mocked(mockApiClient.syncSecrets).mockRejectedValue(
        new Error("API connection failed")
      );

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        found: true,
        fqsn: fqsns[0],
        value: "sk-test-key",
        secretLocation: {
          secretName: "OPENAI_API_KEY",
          secretType: SecretType.ProcessEnv,
        },
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error resolving FQSNs through API")
      );

      consoleWarnSpy.mockRestore();
    });

    test("should use API result when found is true", async () => {
      const fqsns: FQSN[] = [
        { secretName: "HUB_SECRET", ownerSlug: "test", packageSlug: "pkg" },
      ];

      // Set a different value in process.env
      process.env.HUB_SECRET = "local-value";

      // Mock API returning found: true
      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        {
          found: true,
          fqsn: fqsns[0],
          value: "hub-value",
          secretLocation: {
            secretName: "HUB_SECRET",
            secretType: SecretType.Organization,
          },
        },
      ]);

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(1);
      expect(results[0]?.value).toBe("hub-value");
      expect(results[0]?.secretLocation.secretType).toBe(SecretType.Organization);
    });

    test("should handle API returning fewer results than requested", async () => {
      const fqsns: FQSN[] = [
        { secretName: "SECRET_1", ownerSlug: null, packageSlug: null },
        { secretName: "SECRET_2", ownerSlug: null, packageSlug: null },
      ];

      process.env.SECRET_1 = "value-1";
      process.env.SECRET_2 = "value-2";

      // API only returns result for first secret
      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        { found: false, fqsn: fqsns[0] },
      ]);

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(2);
      expect(results[0]?.value).toBe("value-1");
      expect(results[1]?.value).toBe("value-2");
    });

    test("should handle empty API results array", async () => {
      const fqsns: FQSN[] = [
        { secretName: "MY_SECRET", ownerSlug: null, packageSlug: null },
      ];

      process.env.MY_SECRET = "local-value";

      // API returns empty array
      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([]);

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(1);
      expect(results[0]?.value).toBe("local-value");
    });

    test("should fallback to .env files when process.env doesn't have the secret", async () => {
      const fqsns: FQSN[] = [
        { secretName: "FILE_SECRET", ownerSlug: null, packageSlug: null },
      ];

      // Mock API returning not found
      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        { found: false, fqsn: fqsns[0] },
      ]);

      // Mock fs operations for .env file
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("FILE_SECRET=from-env-file\n");

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(1);
      expect(results[0]?.found).toBe(true);
      expect(results[0]?.value).toBe("from-env-file");
      expect(results[0]?.secretLocation.secretType).toBe(SecretType.LocalEnv);
    });

    test("should handle mix of API found and local fallback", async () => {
      const fqsns: FQSN[] = [
        { secretName: "HUB_SECRET", ownerSlug: "test", packageSlug: "pkg" },
        { secretName: "LOCAL_SECRET", ownerSlug: null, packageSlug: null },
      ];

      process.env.LOCAL_SECRET = "local-value";

      // API finds first but not second
      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        {
          found: true,
          fqsn: fqsns[0],
          value: "hub-value",
          secretLocation: {
            secretName: "HUB_SECRET",
            secretType: SecretType.Organization,
          },
        },
        { found: false, fqsn: fqsns[1] },
      ]);

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(2);
      expect(results[0]?.value).toBe("hub-value");
      expect(results[0]?.secretLocation.secretType).toBe(SecretType.Organization);
      expect(results[1]?.value).toBe("local-value");
      expect(results[1]?.secretLocation.secretType).toBe(SecretType.ProcessEnv);
    });
  });

  describe("findSecretInProcessEnv - correct secret type", () => {
    test("should use SecretType.ProcessEnv for process.env secrets", async () => {
      const fqsn: FQSN = {
        secretName: "TEST_KEY",
        ownerSlug: null,
        packageSlug: null,
      };

      process.env.TEST_KEY = "test-value";

      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        { found: false, fqsn },
      ]);

      const results = await platformClient.resolveFQSNs([fqsn]);

      expect(results[0]?.secretLocation.secretType).toBe(SecretType.ProcessEnv);
    });

    test("should handle empty string values from process.env", async () => {
      const fqsn: FQSN = {
        secretName: "EMPTY_KEY",
        ownerSlug: null,
        packageSlug: null,
      };

      process.env.EMPTY_KEY = "";

      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        { found: false, fqsn },
      ]);

      const results = await platformClient.resolveFQSNs([fqsn]);

      expect(results[0]?.found).toBe(true);
      expect(results[0]?.value).toBe("");
    });
  });

  describe("edge cases", () => {
    test("should return empty array for empty input", async () => {
      const results = await platformClient.resolveFQSNs([]);

      expect(results).toEqual([]);
      expect(mockApiClient.syncSecrets).not.toHaveBeenCalled();
    });

    test("should handle undefined secret that doesn't exist anywhere", async () => {
      const fqsns: FQSN[] = [
        { secretName: "NONEXISTENT", ownerSlug: null, packageSlug: null },
      ];

      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([
        { found: false, fqsn: fqsns[0] },
      ]);

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results).toHaveLength(1);
      expect(results[0]).toBeUndefined();
    });

    test("should handle null API results", async () => {
      const fqsns: FQSN[] = [
        { secretName: "TEST", ownerSlug: null, packageSlug: null },
      ];

      process.env.TEST = "fallback-value";

      // API returns array with null element
      vi.mocked(mockApiClient.syncSecrets).mockResolvedValue([null]);

      const results = await platformClient.resolveFQSNs(fqsns);

      expect(results[0]?.value).toBe("fallback-value");
    });
  });
});
