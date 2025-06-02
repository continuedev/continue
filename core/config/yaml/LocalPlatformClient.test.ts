
import {
  FQSN,
  NotFoundSecretLocation,
  PackageSlug,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";

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


describe("LocalPlatformClient", () => {
  let localPlatformClient: LocalPlatformClient;
  let mockControlPlaneClient: jest.Mocked<ControlPlaneClient>;
  let mockIde: jest.Mocked<
    Pick<IDE, "getWorkspaceDirs" | "fileExists" | "readFile">
  >;

  const testPackageSlug: PackageSlug = {
    ownerSlug: "testOwner",
    packageSlug: "testPackage",
  };

  const testFqsn: FQSN = {
    packageSlugs: [testPackageSlug],
    secretName: "TEST_SECRET_KEY",
  };

  beforeEach(() => {
    mockControlPlaneClient = {
      resolveFQSNs: jest.fn(),
    } as any;

    mockIde = {
      getWorkspaceDirs: jest.fn().mockResolvedValue([]),
      fileExists: jest.fn().mockResolvedValue(false),
      readFile: jest.fn().mockResolvedValue(""),
    };

    localPlatformClient = new LocalPlatformClient(
      null,
      mockControlPlaneClient,
      mockIde as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env[testFqsn.secretName];
  });

  it("should resolve a secret from process.env if not found elsewhere", async () => {
    const secretValue = "secret_from_process_env";
    process.env[testFqsn.secretName] = secretValue;

    mockIde.getWorkspaceDirs.mockResolvedValue([]);
    mockControlPlaneClient.resolveFQSNs.mockResolvedValue([
      {
        found: false,
        fqsn: testFqsn,
        secretLocation: {
          secretName: testFqsn.secretName,
          secretType: SecretType.NotFound,
        } as NotFoundSecretLocation,
      },
    ]);

    const results = await localPlatformClient.resolveFQSNs([testFqsn]);

    expect(results).toHaveLength(1);
    const result = results[0] as SecretResult & { value?: string };
    expect(result).toBeDefined();
    expect(result?.found).toBe(true);
    expect(result?.value).toBe(secretValue);
    expect(result?.secretLocation.secretType).toBe("process_env");
    expect(result?.secretLocation.secretName).toBe(testFqsn.secretName);

    expect(mockIde.getWorkspaceDirs).toHaveBeenCalled();
    expect(mockControlPlaneClient.resolveFQSNs).toHaveBeenCalledWith(
      [testFqsn],
      null,
    );
  });

  it("should prioritize local .env file over process.env", async () => {
    const localEnvSecretValue = "secret_from_local_env";
    const processEnvSecretValue = "secret_from_process_env";

    process.env[testFqsn.secretName] = processEnvSecretValue;

    const originalFindSecretInEnvFiles = (localPlatformClient as any)
      .findSecretInEnvFiles;
    (localPlatformClient as any).findSecretInEnvFiles = jest
      .fn()
      .mockResolvedValue({
        found: true,
        fqsn: testFqsn,
        value: localEnvSecretValue,
        secretLocation: {
          secretName: testFqsn.secretName,
          secretType: SecretType.LocalEnv,
        },
      });

    const results = await localPlatformClient.resolveFQSNs([testFqsn]);

    expect(results).toHaveLength(1);
    const result = results[0] as SecretResult & { value?: string };
    expect(result).toBeDefined();
    expect(result?.found).toBe(true);
    expect(result?.value).toBe(localEnvSecretValue);
    expect(result?.secretLocation.secretType).toBe(SecretType.LocalEnv);

    (localPlatformClient as any).findSecretInEnvFiles =
      originalFindSecretInEnvFiles;
  });

  it("should prioritize API secret over process.env", async () => {
    const apiSecretValue = "secret_from_api";
    const processEnvSecretValue = "secret_from_process_env";

    process.env[testFqsn.secretName] = processEnvSecretValue;

    mockIde.getWorkspaceDirs.mockResolvedValue([]);
    mockControlPlaneClient.resolveFQSNs.mockResolvedValue([
      {
        found: true,
        fqsn: testFqsn,
        value: apiSecretValue,
        secretLocation: {
          secretName: testFqsn.secretName,
          secretType: SecretType.User,
          userSlug: "testUser",
        },
      },
    ]);

    const results = await localPlatformClient.resolveFQSNs([testFqsn]);

    expect(results).toHaveLength(1);
    const result = results[0] as SecretResult & { value?: string };
    expect(result).toBeDefined();
    expect(result?.found).toBe(true);
    expect(result?.value).toBe(apiSecretValue);
    expect(result?.secretLocation.secretType).not.toBe("process_env");
    expect(result?.secretLocation.secretType).toBe(SecretType.User);

    expect(mockControlPlaneClient.resolveFQSNs).toHaveBeenCalled();
  });

  it("should return NotFound if secret is not in .env, API, or process.env", async () => {
    delete process.env[testFqsn.secretName];
    mockIde.getWorkspaceDirs.mockResolvedValue([]);
    mockControlPlaneClient.resolveFQSNs.mockResolvedValue([
      {
        found: false,
        fqsn: testFqsn,
        secretLocation: {
          secretName: testFqsn.secretName,
          secretType: SecretType.NotFound,
        } as NotFoundSecretLocation,
      },
    ]);

    const results = await localPlatformClient.resolveFQSNs([testFqsn]);

    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result).toBeDefined();
    expect(result?.found).toBe(false);
    expect(result?.secretLocation.secretType).toBe(SecretType.NotFound);
    expect((result as any).value).toBeUndefined();

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
