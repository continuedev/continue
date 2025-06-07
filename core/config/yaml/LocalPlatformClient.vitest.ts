import { FQSN, SecretResult, SecretType } from "@continuedev/config-yaml";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  Mock,
  test,
  vi,
} from "vitest";
import { IDE } from "../..";
import { ControlPlaneClient } from "../../control-plane/client";
import { LocalPlatformClient } from "./LocalPlatformClient";

vi.mock("../../util/paths", { spy: true });

describe("LocalPlatformClient", () => {
  const testFQSN: FQSN = {
    packageSlugs: [
      {
        ownerSlug: "test-owner-slug",
        packageSlug: "test-package-slug",
      },
    ],
    secretName: "TEST_CONTINUE_SECRET_KEY",
  };
  const testFQSN2: FQSN = {
    packageSlugs: [
      {
        ownerSlug: "test-owner-slug-2",
        packageSlug: "test-package-slug-2",
      },
    ],
    secretName: "TEST_WORKSPACE_SECRET_KEY",
  };

  const testResolvedFQSN: SecretResult = {
    found: true,
    fqsn: testFQSN,
    secretLocation: {
      secretName: testFQSN.secretName,
      secretType: SecretType.Organization,
      orgSlug: "test-org-slug",
    },
  };

  let testControlPlaneClient: ControlPlaneClient;
  let testIde: IDE;
  beforeEach(
    /**dynamic import before each test for test isolation */
    async () => {
      const testFixtures = await import("../../test/fixtures");
      testControlPlaneClient = testFixtures.testControlPlaneClient;
      testIde = testFixtures.testIde;
    },
  );

  let secretValue: string;
  let envKeyValues: Record<string, unknown>;
  let envKeyValuesString: string;
  beforeEach(
    /**generate unique env key value pairs for each test */
    () => {
      secretValue = Math.floor(Math.random() * 100) + "";
      envKeyValues = {
        TEST_CONTINUE_SECRET_KEY: secretValue,
        TEST_WORKSPACE_SECRET_KEY: secretValue + "-workspace",
      };
      envKeyValuesString = Object.entries(envKeyValues)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    },
  );

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.resetModules(); // clear dynamic imported module cache
  });

  test("should not be able to resolve FQSNs if they do not exist", async () => {
    const localPlatformClient = new LocalPlatformClient(
      null,
      testControlPlaneClient,
      testIde,
    );
    const resolvedFQSNs = await localPlatformClient.resolveFQSNs([testFQSN]);

    expect(resolvedFQSNs.length).toBeGreaterThan(0);
    expect(resolvedFQSNs[0]?.found).toBe(false);
  });

  test("should be able to resolve FQSNs if they exist", async () => {
    testControlPlaneClient.resolveFQSNs = vi.fn(async () => [testResolvedFQSN]);
    const localPlatformClient = new LocalPlatformClient(
      null,
      testControlPlaneClient,
      testIde,
    );
    const resolvedFQSNs = await localPlatformClient.resolveFQSNs([testFQSN]);
    expect(testControlPlaneClient.resolveFQSNs).toHaveBeenCalled();
    expect(resolvedFQSNs).toEqual([testResolvedFQSN]);
    expect(resolvedFQSNs[0]?.found).toBe(true);
  });

  describe("searches for secrets in local .env files", () => {
    let getContinueDotEnv: Mock;
    beforeEach(async () => {
      const utilPaths = await import("../../util/paths");
      getContinueDotEnv = vi.fn(() => envKeyValues);
      utilPaths.getContinueDotEnv = getContinueDotEnv;
    });

    test("should be able to get secrets from ~/.continue/.env files", async () => {
      const localPlatformClient = new LocalPlatformClient(
        null,
        testControlPlaneClient,
        testIde,
      );
      const resolvedFQSNs = await localPlatformClient.resolveFQSNs([testFQSN]);
      expect(getContinueDotEnv).toHaveBeenCalled();
      expect(resolvedFQSNs.length).toBe(1);
      expect(
        (resolvedFQSNs[0] as SecretResult & { value: unknown })?.value,
      ).toBe(secretValue);
      console.log("debug1 resolved fqsn", resolvedFQSNs);
    });
  });

  describe("should be able to get secrets from workspace .env files", () => {
    test("should get secrets from <workspace>/.continue/.env and <workspace>/.env", async () => {
      const originalIdeFileExists = testIde.fileExists;
      testIde.fileExists = vi.fn(async (fileUri: string) =>
        fileUri.includes(".env") ? true : originalIdeFileExists(fileUri),
      );

      const originalIdeReadFile = testIde.readFile;
      const randomValueForContinueDirDotEnv =
        "continue-dir-" + Math.floor(Math.random() * 100);
      const randomValueForWorkspaceDotEnv =
        "dotenv-" + Math.floor(Math.random() * 100);

      testIde.readFile = vi.fn(async (fileUri: string) => {
        // fileUri should contain .continue/.env and not .env
        if (fileUri.match(/.*\.continue\/\.env.*/gi)?.length) {
          return (
            envKeyValuesString.split("\n")[0] + randomValueForContinueDirDotEnv
          );
        }
        // filUri should contain .env and not .continue/.env
        else if (fileUri.match(/.*(?<!\.continue\/)\.env.*/gi)?.length) {
          return (
            envKeyValuesString.split("\n")[1] + randomValueForWorkspaceDotEnv
          );
        }
        return originalIdeReadFile(fileUri);
      });

      const localPlatformClient = new LocalPlatformClient(
        null,
        testControlPlaneClient,
        testIde,
      );
      const resolvedFQSNs = await localPlatformClient.resolveFQSNs([
        testFQSN,
        testFQSN2,
      ]);

      // both the secrets should be present as they are retrieved from different files

      expect(resolvedFQSNs.length).toBe(2);

      const continueDirSecretValue = (
        resolvedFQSNs[0] as SecretResult & { value: unknown }
      )?.value;
      const dotEnvSecretValue = (
        resolvedFQSNs[1] as SecretResult & { value: unknown }
      )?.value;
      expect(continueDirSecretValue).toContain(secretValue);
      expect(continueDirSecretValue).toContain(randomValueForContinueDirDotEnv);
      expect(dotEnvSecretValue).toContain(secretValue + "-workspace");
      expect(dotEnvSecretValue).toContain(randomValueForWorkspaceDotEnv);
    });

    test("should first get secrets from <workspace>/.continue/.env and then <workspace>/.env", async () => {
      const originalIdeFileExists = testIde.fileExists;
      testIde.fileExists = vi.fn(async (fileUri: string) =>
        fileUri.includes(".env") ? true : originalIdeFileExists(fileUri),
      );

      const randomValueForContinueDirDotEnv =
        "continue-dir-" + Math.floor(Math.random() * 100);
      const randomValueForWorkspaceDotEnv =
        "dotenv-" + Math.floor(Math.random() * 100);

      const originalIdeReadFile = testIde.readFile;
      testIde.readFile = vi.fn(async (fileUri: string) => {
        // fileUri should contain .continue/.env and not .env
        if (fileUri.match(/.*\.continue\/\.env.*/gi)?.length) {
          return (
            envKeyValuesString.split("\n")[0] + randomValueForContinueDirDotEnv
          );
        }
        // filUri should contain .env and not .continue/.env
        else if (fileUri.match(/.*(?<!\.continue\/)\.env.*/gi)?.length) {
          return (
            envKeyValuesString.split("\n")[0] + randomValueForWorkspaceDotEnv
          );
        }
        return originalIdeReadFile(fileUri);
      });

      const localPlatformClient = new LocalPlatformClient(
        null,
        testControlPlaneClient,
        testIde,
      );
      const resolvedFQSNs = await localPlatformClient.resolveFQSNs([testFQSN]);

      expect(resolvedFQSNs.length).toBe(1);
      expect(
        (resolvedFQSNs[0] as SecretResult & { value: unknown })?.value,
      ).toContain(secretValue);
      // we check that workspace <workspace>.continue/.env does not override the <workspace>/.env secret
      expect(
        (resolvedFQSNs[0] as SecretResult & { value: unknown })?.value,
      ).toContain(randomValueForContinueDirDotEnv);
      expect(
        (resolvedFQSNs[0] as SecretResult & { value: unknown })?.value,
      ).not.toContain(randomValueForWorkspaceDotEnv);
    });
  });
});
