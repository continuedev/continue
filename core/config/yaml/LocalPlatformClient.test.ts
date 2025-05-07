import { FQSN, SecretResult, SecretType } from "@continuedev/config-yaml";
import { testControlPlaneClient, testIde } from "../../test/fixtures";
import { LocalPlatformClient } from "./LocalPlatformClient";

jest.mock("../../util/paths.ts", () => ({
  ...jest.requireActual("../../util/paths"),
  getContinueDotEnv: jest.fn(),
}));

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
  const testResolvedFQSN: SecretResult = {
    found: true,
    fqsn: testFQSN,
    secretLocation: {
      secretName: testFQSN.secretName,
      secretType: SecretType.Organization,
      orgSlug: "test-org-slug",
    },
  };

  afterEach(() => jest.restoreAllMocks());

  test("should not be able to resolve FQSNs if they do not exist", async () => {
    testControlPlaneClient.resolveFQSNs = jest.fn(async () => [
      testResolvedFQSN,
    ]);
    const localPlatformClient = new LocalPlatformClient(
      null,
      testControlPlaneClient,
      testIde,
    );
    const resolvedFQSNs = await localPlatformClient.resolveFQSNs([testFQSN]);
    expect(testControlPlaneClient.resolveFQSNs).toHaveBeenCalled();
    expect(resolvedFQSNs).toEqual([testResolvedFQSN]);
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

  describe.only("searches for secrets in local .env files", () => {
    const secretValue = Math.floor(Math.random() * 100) + "";
    const envKeyValues = {
      TEST_CONTINUE_SECRET_KEY: secretValue,
    };
    const getContinueDotEnv = jest.fn(() => envKeyValues);

    beforeEach(async () => {
      //   const directoryExists = fs.existsSync("./_tests");
      //   if (directoryExists) {
      //     fs.rmSync("./_tests", { force: true, recursive: true });
      //   }
      //   const envFileContent = `TEST_CONTINUE_SECRET_KEY=${secretValue}`;
      //   fs.writeFileSync("./_tests/.env", envFileContent);
      //   utilPaths.getContinueDotEnv = getContinueDotEnv
      // const spy = jest.spyOn(utilPaths, 'getContinueDotEnv')
      // Object.defineProperty(utilPaths, 'getContinueDotEnv', {
      //   writable: true,
      //   configurable: true,
      //   value: spy.mockImplementation(() => envKeyValues),
      // });
      //   jest.mock(utilPaths, () => ({
      //     ...jest.requireActual(utilPaths),
      //     getContinueDotEnv: jest.fn().mockReturnValue(envKeyValues)
      //   }))
    });

    test("should be able to get secrets from global ~/.continue/.env files", async () => {
      const localPlatformClient = new LocalPlatformClient(
        null,
        testControlPlaneClient,
        testIde,
      );
      const resolvedFQSNs = await localPlatformClient.resolveFQSNs([testFQSN]);
      expect(getContinueDotEnv).toHaveBeenCalled();
      console.log("resolved->", resolvedFQSNs);
    });
  });
});
