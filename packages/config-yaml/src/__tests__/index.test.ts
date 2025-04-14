import * as fs from "fs";
import {
  decodeSecretLocation,
  FQSN,
  FullSlug,
  PlatformClient,
  PlatformSecretStore,
  Registry,
  resolveFQSN,
  resolveSecretLocationInProxy,
  SecretLocation,
  SecretResult,
  SecretStore,
  SecretType,
  unrollAssistant,
} from "../index.js";

// Test e2e flows from raw yaml -> unroll -> client render -> resolve secrets on proxy
describe("E2E Scenarios", () => {
  const userSecrets: Record<string, string> = {
    OPENAI_API_KEY: "sk-123",
  };

  const orgSecrets: Record<string, string> = {
    GEMINI_API_KEY: "gemini-api-key",
  };

  const proxyEnvSecrets: Record<string, string> = {
    ANTHROPIC_API_KEY: "sk-ant-env",
    GEMINI_API_KEY: "gemini-api-key-env",
  };

  const localUserSecretStore: SecretStore = {
    get: async function (secretName: string): Promise<string | undefined> {
      return userSecrets[secretName];
    },
    set: function (secretName: string, secretValue: string): Promise<void> {
      throw new Error("Function not implemented.");
    },
  };

  const platformClient: PlatformClient = {
    resolveFQSNs: async function (
      fqsns: FQSN[],
    ): Promise<(SecretResult | undefined)[]> {
      return await Promise.all(
        fqsns.map((fqsn) =>
          resolveFQSN("test-user", fqsn, platformSecretStore, "test-org"),
        ),
      );
    },
  };

  const environmentSecretStore: SecretStore = {
    get: async function (secretName: string): Promise<string | undefined> {
      return proxyEnvSecrets[secretName];
    },
    set: function (secretName: string, secretValue: string): Promise<void> {
      throw new Error("Function not implemented.");
    },
  };

  const platformSecretStore: PlatformSecretStore = {
    getSecretFromSecretLocation: async function (
      secretLocation: SecretLocation,
    ): Promise<string | undefined> {
      switch (secretLocation.secretType) {
        case SecretType.Package:
          return undefined;
        case SecretType.User:
          return userSecrets[secretLocation.secretName];
        case SecretType.Organization:
          return orgSecrets[secretLocation.secretName];
        case SecretType.ModelsAddOn:
        case SecretType.FreeTrial:
          if (
            secretLocation.blockSlug.ownerSlug === "test-org" &&
            secretLocation.blockSlug.packageSlug === "claude35sonnet" &&
            secretLocation.secretName === "ANTHROPIC_API_KEY"
          ) {
            return "sk-ant";
          }
          return undefined;
        case SecretType.NotFound:
          return undefined;
        default:
          return undefined;
      }
    },
  };

  const registry: Registry = {
    getContent: async function (fullSlug: FullSlug): Promise<string> {
      return fs
        .readFileSync(
          `./src/__tests__/packages/${fullSlug.ownerSlug}/${fullSlug.packageSlug}.yaml`,
        )
        .toString();
    },
  };

  it("should unroll assistant with a single block that doesn't exist", async () => {
    const unrolledConfig = await unrollAssistant(
      "test-org/assistant-with-non-existing-block",
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
      },
    );

    expect(unrolledConfig.rules?.[0]).toBeNull();
  });

  it("should correctly unroll assistant", async () => {
    const unrolledConfig = await unrollAssistant(
      "test-org/assistant",
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
      },
    );

    // Test that packages were correctly unrolled and params replaced
    expect(unrolledConfig.models?.length).toBe(3);

    const openAiModel = unrolledConfig.models?.[0]!;
    expect(openAiModel.apiKey).toBe("sk-123");

    const geminiModel = unrolledConfig.models?.[1]!;
    expect(geminiModel.provider).toBe("continue-proxy");
    expect(geminiModel.apiKey).toBeUndefined();
    const geminiSecretLocation = "organization:test-org/GEMINI_API_KEY";
    expect((geminiModel as any).apiKeyLocation).toBe(geminiSecretLocation);

    const anthropicModel = unrolledConfig.models?.[2]!;
    expect(anthropicModel.provider).toBe("continue-proxy");
    expect(anthropicModel.apiKey).toBeUndefined();
    const anthropicSecretLocation =
      "models_add_on:test-org/claude35sonnet/ANTHROPIC_API_KEY";
    expect((anthropicModel as any).apiKeyLocation).toBe(
      anthropicSecretLocation,
    );

    expect(unrolledConfig.rules?.length).toBe(2);
    expect(unrolledConfig.docs?.[0]?.startUrl).toBe(
      "https://docs.python.org/release/3.13.1",
    );
    expect(unrolledConfig.docs?.[0]?.rootUrl).toBe(
      "https://docs.python.org/release/3.13.1",
    );

    // Test that proxy can correctly resolve secrets
    const decodedAnthropicSecretLocation = decodeSecretLocation(
      anthropicSecretLocation,
    );
    const decodedGeminiSecretLocation =
      decodeSecretLocation(geminiSecretLocation);

    // With environment
    const antSecretValue = await resolveSecretLocationInProxy(
      decodedAnthropicSecretLocation,
      platformSecretStore,
      environmentSecretStore,
    );
    expect(antSecretValue).toBe("sk-ant-env");
    const geminiSecretValue = await resolveSecretLocationInProxy(
      decodedGeminiSecretLocation,
      platformSecretStore,
      environmentSecretStore,
    );
    expect(geminiSecretValue).toBe("gemini-api-key-env");

    // Without environment
    const antSecretValue2 = await resolveSecretLocationInProxy(
      decodedAnthropicSecretLocation,
      platformSecretStore,
      undefined,
    );
    expect(antSecretValue2).toBe("sk-ant");
    const geminiSecretValue2 = await resolveSecretLocationInProxy(
      decodedGeminiSecretLocation,
      platformSecretStore,
      undefined,
    );
    expect(geminiSecretValue2).toBe("gemini-api-key");
  });

  it("should correctly unroll assistant with injected blocks", async () => {
    const unrolledConfig = await unrollAssistant(
      "test-org/assistant",
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
        // Add an injected block
        injectBlocks: [
          {
            ownerSlug: "test-org",
            packageSlug: "docs",
            versionSlug: "latest",
          },
        ],
      },
    );

    // The original docs array should have one item
    expect(unrolledConfig.docs?.length).toBe(2); // Now 2 with the injected block

    // Check the original doc is still there
    expect(unrolledConfig.docs?.[0]?.startUrl).toBe(
      "https://docs.python.org/release/3.13.1",
    );

    // Check the injected doc block was added
    expect(unrolledConfig.docs?.[1]?.startUrl).toBe(
      "https://docs.python.org/release/3.13.1",
    );
  });

  it.skip("should prioritize org over user / package secrets", () => {});
});
