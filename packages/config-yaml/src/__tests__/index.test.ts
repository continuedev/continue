import * as fs from "fs";
import {
  decodeSecretLocation,
  FQSN,
  PackageIdentifier,
  packageIdentifierToShorthandSlug,
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
    getContent: async function (id: PackageIdentifier): Promise<string> {
      const slug = packageIdentifierToShorthandSlug(id);
      const filePath =
        id.uriType === "slug"
          ? `./src/__tests__/packages/${slug}.yaml`
          : id.fileUri;
      return fs.readFileSync(filePath).toString();
    },
  };

  it("should unroll assistant with a single block that doesn't exist", async () => {
    const unrolledConfig = await unrollAssistant(
      {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "test-org",
          packageSlug: "agent-with-non-existing-block",
          versionSlug: "latest",
        },
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
      },
    );

    expect(unrolledConfig.config?.rules?.[0]).toBeNull();
  });

  it("should correctly unroll assistant", async () => {
    const unrolledConfig = await unrollAssistant(
      {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "test-org",
          packageSlug: "agent",
          versionSlug: "latest",
        },
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
      },
    );

    const config = unrolledConfig.config;

    // Test that packages were correctly unrolled and params replaced
    expect(config?.models?.length).toBe(4);

    const openAiModel = config?.models?.[0]!;
    expect(openAiModel.apiKey).toBe("sk-123");

    const geminiModel = config?.models?.[1]!;
    expect(geminiModel.provider).toBe("continue-proxy");
    expect(geminiModel.apiKey).toBeUndefined();
    const geminiSecretLocation = "organization:test-org/GEMINI_API_KEY";
    expect((geminiModel as any).apiKeyLocation).toBe(geminiSecretLocation);

    const anthropicModel = config?.models?.[2]!;
    expect(anthropicModel.provider).toBe("continue-proxy");
    expect(anthropicModel.apiKey).toBeUndefined();
    const anthropicSecretLocation =
      "models_add_on:test-org/claude35sonnet/ANTHROPIC_API_KEY";
    expect((anthropicModel as any).apiKeyLocation).toBe(
      anthropicSecretLocation,
    );

    const proxyOllamaModel = config?.models?.[3]!;
    expect(proxyOllamaModel.provider).toBe("ollama");
    expect(proxyOllamaModel.defaultCompletionOptions?.stream).toBe(false);

    expect(config?.rules?.length).toBe(2);
    expect(config?.docs?.[0]?.startUrl).toBe(
      "https://docs.python.org/release/3.13.1",
    );
    expect(config?.docs?.[0]?.rootUrl).toBe(
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
      {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "test-org",
          packageSlug: "agent",
          versionSlug: "latest",
        },
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
        // Add injected blocks
        injectBlocks: [
          {
            uriType: "slug",
            fullSlug: {
              ownerSlug: "test-org",
              packageSlug: "rules",
              versionSlug: "latest",
            },
          },
          {
            uriType: "file",
            fileUri: "./src/__tests__/local-files/rules.yaml",
          },
        ],
      },
    );

    const config = unrolledConfig.config;

    // The original rules array should have two items
    expect(config?.rules?.length).toBe(3); // Now 3 with the injected block

    // Check the original doc is still there
    expect(config?.docs?.[0]?.startUrl).toBe(
      "https://docs.python.org/release/3.13.1",
    );

    // Check the injected doc block was added
    expect(
      typeof config?.rules?.[2] !== "string" &&
        config?.rules?.[2]?.rule === "Be humble",
    );
  });

  it("duplicate detection should happen in the assistant config first and then the injected blocks", async () => {
    const unrolledConfig = await unrollAssistant(
      {
        uriType: "file",
        fileUri: "./src/__tests__/local-files/duplicate-test-agent.yaml",
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
        // Add injected blocks
        injectBlocks: [
          {
            uriType: "file",
            fileUri: "./src/__tests__/local-files/rules.yaml",
          },
          {
            uriType: "file",
            fileUri: "./src/__tests__/local-files/mcpServer.yaml",
          },
          {
            uriType: "file",
            fileUri: "./src/__tests__/local-files/prompt.yaml",
          },
        ],
      },
    );

    const config = unrolledConfig.config;
    const errors = unrolledConfig.errors;

    // Check if all the duplicate blocks get removed
    expect(config?.models?.length).toBe(1);
    expect(config?.context?.length).toBe(1);
    expect(config?.mcpServers?.length).toBe(1);
    expect(config?.rules?.length).toBe(1);
    expect(config?.prompts?.length).toBe(1);
    expect(config?.docs?.length).toBe(1);
  });

  it("should throw when a block is blocklisted", async () => {
    const result = await unrollAssistant(
      {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "test-org",
          packageSlug: "agent",
          versionSlug: "latest",
        },
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
        blocklistedBlocks: [
          {
            ownerSlug: "test-org",
            packageSlug: "gemini",
          },
        ],
      },
    );

    // Should contain an error about the blocklisted block
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(
      result.errors?.some((error) =>
        error.message.includes(
          "test-org/gemini is block listed and can not be used.",
        ),
      ),
    ).toBe(true);
  });

  it("should return an error when a block is not on the allowlist", async () => {
    const result = await unrollAssistant(
      {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "test-org",
          packageSlug: "agent",
          versionSlug: "latest",
        },
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
        allowlistedBlocks: [
          {
            ownerSlug: "test-org",
            packageSlug: "docs",
          },
          {
            ownerSlug: "test-org",
            packageSlug: "rules",
          },
          {
            ownerSlug: "test-org",
            packageSlug: "claude35sonnet",
          },
        ],
      },
    );

    // Should contain an error about the non-allowlisted block (gemini)
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(
      result.errors?.some((error) =>
        error.message.includes(
          "test-org/gemini is block listed and can not be used.",
        ),
      ),
    ).toBe(true);
  });

  it("should allow blocks when they are on the allowlist", async () => {
    const result = await unrollAssistant(
      {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "test-org",
          packageSlug: "agent",
          versionSlug: "latest",
        },
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
        allowlistedBlocks: [
          {
            ownerSlug: "test-org",
            packageSlug: "docs",
          },
          {
            ownerSlug: "test-org",
            packageSlug: "rules",
          },
          {
            ownerSlug: "test-org",
            packageSlug: "gemini",
          },
          {
            ownerSlug: "test-org",
            packageSlug: "claude35sonnet",
          },
        ],
      },
    );

    // Should successfully unroll without errors for allowed blocks
    expect(result.config?.models?.length).toBe(4);
    expect(result.config?.rules?.length).toBe(2);
    expect(result.config?.docs?.length).toBe(1);
  });

  it("should not affect file-based blocks with allow/blocklists", async () => {
    const result = await unrollAssistant(
      {
        uriType: "file",
        fileUri: "./src/__tests__/local-files/duplicate-test-agent.yaml",
      },
      registry,
      {
        renderSecrets: true,
        platformClient,
        orgScopeId: "test-org",
        currentUserSlug: "test-user",
        onPremProxyUrl: null,
        blocklistedBlocks: [
          {
            ownerSlug: "test-org",
            packageSlug: "docs",
          },
        ],
        injectBlocks: [
          {
            uriType: "file",
            fileUri: "./src/__tests__/local-files/rules.yaml",
          },
        ],
      },
    );

    // File-based blocks should not be affected by blocklists
    expect(result.config?.models?.length).toBe(1);
    expect(result.config?.context?.length).toBe(1);
    expect(result.config?.rules?.length).toBeGreaterThan(0);
  });

  it.skip("should prioritize org over user / package secrets", () => {});
});
