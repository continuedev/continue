import { SecretType } from "@continuedev/config-yaml";
import { BrowserSerializedContinueConfig } from "core";
import { usesFreeTrialApiKey } from "./freeTrialHelpers";

// Mock the decodeSecretLocation function
vi.mock("@continuedev/config-yaml", async () => {
  const actual = await vi.importActual("@continuedev/config-yaml");
  return {
    ...actual,
    decodeSecretLocation: vi.fn(),
  };
});

const { decodeSecretLocation } = await import("@continuedev/config-yaml");

describe("usesFreeTrialApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when config is null", () => {
    const result = usesFreeTrialApiKey(null);
    expect(result).toBe(false);
  });

  it("should return false when config is undefined", () => {
    const result = usesFreeTrialApiKey(undefined as any);
    expect(result).toBe(false);
  });

  it("should return false when no models have apiKeyLocation", () => {
    const config: BrowserSerializedContinueConfig = {
      modelsByRole: {
        chat: [
          {
            title: "Model 1",
            provider: "test",
            model: "test-model",
            underlyingProviderName: "test",
          },
          {
            title: "Model 2",
            provider: "test",
            model: "test-model-2",
            underlyingProviderName: "test",
          },
        ],
        edit: [],
        apply: [],
        summarize: [],
        autocomplete: [],
        rerank: [],
        embed: [],
      },
      selectedModelByRole: {
        chat: null,
        edit: null,
        apply: null,
        summarize: null,
        autocomplete: null,
        rerank: null,
        embed: null,
      },
      contextProviders: [],
      slashCommands: [],
      tools: [],
      mcpServerStatuses: [],
      usePlatform: false,
      rules: [],
    };

    const result = usesFreeTrialApiKey(config);
    expect(result).toBe(false);
  });

  it("should return false when models have apiKeyLocation but none are free trial", () => {
    const config: BrowserSerializedContinueConfig = {
      modelsByRole: {
        chat: [
          {
            title: "Model 1",
            provider: "test",
            model: "test-model",
            apiKeyLocation: "user:testuser/api-key",
            underlyingProviderName: "test",
          },
        ],
        edit: [
          {
            title: "Model 2",
            provider: "test",
            model: "test-model-2",
            apiKeyLocation: "organization:testorg/api-key",
            underlyingProviderName: "test",
          },
        ],
        apply: [],
        summarize: [],
        autocomplete: [],
        rerank: [],
        embed: [],
      },
      selectedModelByRole: {
        chat: null,
        edit: null,
        apply: null,
        summarize: null,
        autocomplete: null,
        rerank: null,
        embed: null,
      },
      contextProviders: [],
      slashCommands: [],
      tools: [],
      mcpServerStatuses: [],
      usePlatform: false,
      rules: [],
    };

    vi.mocked(decodeSecretLocation)
      .mockReturnValueOnce({
        secretType: SecretType.User,
        userSlug: "testuser",
        secretName: "api-key",
      })
      .mockReturnValueOnce({
        secretType: SecretType.Organization,
        orgSlug: "testorg",
        secretName: "api-key",
      });

    const result = usesFreeTrialApiKey(config);
    expect(result).toBe(false);
    expect(decodeSecretLocation).toHaveBeenCalledTimes(2);
  });

  it("should return true when at least one model uses free trial API key", () => {
    const config: BrowserSerializedContinueConfig = {
      modelsByRole: {
        chat: [
          {
            title: "Model 1",
            provider: "test",
            model: "test-model",
            apiKeyLocation: "user:testuser/api-key",
            underlyingProviderName: "test",
          },
          {
            title: "Free Trial Model",
            provider: "test",
            model: "free-trial-model",
            apiKeyLocation: "free_trial:owner/package/api-key",
            underlyingProviderName: "test",
          },
        ],
        edit: [],
        apply: [],
        summarize: [],
        autocomplete: [],
        rerank: [],
        embed: [],
      },
      selectedModelByRole: {
        chat: null,
        edit: null,
        apply: null,
        summarize: null,
        autocomplete: null,
        rerank: null,
        embed: null,
      },
      contextProviders: [],
      slashCommands: [],
      tools: [],
      mcpServerStatuses: [],
      usePlatform: false,
      rules: [],
    };

    vi.mocked(decodeSecretLocation)
      .mockReturnValueOnce({
        secretType: SecretType.User,
        userSlug: "testuser",
        secretName: "api-key",
      })
      .mockReturnValueOnce({
        secretType: SecretType.FreeTrial,
        blockSlug: { ownerSlug: "owner", packageSlug: "package" },
        secretName: "api-key",
      });

    const result = usesFreeTrialApiKey(config);
    expect(result).toBe(true);
    expect(decodeSecretLocation).toHaveBeenCalledTimes(2);
  });

  it("should return true when free trial model is in a different role", () => {
    const config: BrowserSerializedContinueConfig = {
      modelsByRole: {
        chat: [
          {
            title: "Model 1",
            provider: "test",
            model: "test-model",
            apiKeyLocation: "user:testuser/api-key",
            underlyingProviderName: "test",
          },
        ],
        edit: [
          {
            title: "Free Trial Edit Model",
            provider: "test",
            model: "free-trial-edit-model",
            apiKeyLocation: "free_trial:owner/package/api-key",
            underlyingProviderName: "test",
          },
        ],
        apply: [],
        summarize: [],
        autocomplete: [],
        rerank: [],
        embed: [],
      },
      selectedModelByRole: {
        chat: null,
        edit: null,
        apply: null,
        summarize: null,
        autocomplete: null,
        rerank: null,
        embed: null,
      },
      contextProviders: [],
      slashCommands: [],
      tools: [],
      mcpServerStatuses: [],
      usePlatform: false,
      rules: [],
    };

    vi.mocked(decodeSecretLocation)
      .mockReturnValueOnce({
        secretType: SecretType.User,
        userSlug: "testuser",
        secretName: "api-key",
      })
      .mockReturnValueOnce({
        secretType: SecretType.FreeTrial,
        blockSlug: { ownerSlug: "owner", packageSlug: "package" },
        secretName: "api-key",
      });

    const result = usesFreeTrialApiKey(config);
    expect(result).toBe(true);
  });

  it("should return false and log error when decodeSecretLocation throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const config: BrowserSerializedContinueConfig = {
      modelsByRole: {
        chat: [
          {
            title: "Model 1",
            provider: "test",
            model: "test-model",
            apiKeyLocation: "invalid-secret-location",
            underlyingProviderName: "test",
          },
        ],
        edit: [],
        apply: [],
        summarize: [],
        autocomplete: [],
        rerank: [],
        embed: [],
      },
      selectedModelByRole: {
        chat: null,
        edit: null,
        apply: null,
        summarize: null,
        autocomplete: null,
        rerank: null,
        embed: null,
      },
      contextProviders: [],
      slashCommands: [],
      tools: [],
      mcpServerStatuses: [],
      usePlatform: false,
      rules: [],
    };

    vi.mocked(decodeSecretLocation).mockImplementation(() => {
      throw new Error("Invalid secret location format");
    });

    const result = usesFreeTrialApiKey(config);
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error checking for free trial API key:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("should handle empty modelsByRole object", () => {
    const config: BrowserSerializedContinueConfig = {
      modelsByRole: {
        chat: [],
        edit: [],
        apply: [],
        summarize: [],
        autocomplete: [],
        rerank: [],
        embed: [],
      },
      selectedModelByRole: {
        chat: null,
        edit: null,
        apply: null,
        summarize: null,
        autocomplete: null,
        rerank: null,
        embed: null,
      },
      contextProviders: [],
      slashCommands: [],
      tools: [],
      mcpServerStatuses: [],
      usePlatform: false,
      rules: [],
    };

    const result = usesFreeTrialApiKey(config);
    expect(result).toBe(false);
    expect(decodeSecretLocation).not.toHaveBeenCalled();
  });
});
