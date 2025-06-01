import {
  FQSN,
  NotFoundSecretLocation,
  PackageSlug,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";
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
  });
});
