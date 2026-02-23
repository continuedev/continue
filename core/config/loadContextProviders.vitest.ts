import { beforeEach, describe, expect, it, MockedFunction, vi } from "vitest";
import { contextProviderClassFromName } from "../context/providers";
import CurrentFileContextProvider from "../context/providers/CurrentFileContextProvider";
import DiffContextProvider from "../context/providers/DiffContextProvider";
import FileContextProvider from "../context/providers/FileContextProvider";
import ProblemsContextProvider from "../context/providers/ProblemsContextProvider";
import RulesContextProvider from "../context/providers/RulesContextProvider";
import TerminalContextProvider from "../context/providers/TerminalContextProvider";
import { loadConfigContextProviders } from "./loadContextProviders";

// Mock the contextProviderClassFromName function
vi.mock("../context/providers", () => ({
  contextProviderClassFromName: vi.fn(),
}));

// Mock all provider classes
vi.mock("../context/providers/CurrentFileContextProvider", () => ({
  default: vi.fn().mockImplementation((options) => ({
    description: { title: "current-file" },
    options,
  })),
}));

vi.mock("../context/providers/DiffContextProvider", () => ({
  default: vi.fn().mockImplementation((options) => ({
    description: { title: "diff" },
    options,
  })),
}));

vi.mock("../context/providers/FileContextProvider", () => ({
  default: vi.fn().mockImplementation((options) => ({
    description: { title: "file" },
    options,
  })),
}));

vi.mock("../context/providers/ProblemsContextProvider", () => {
  const MockProblemsContextProvider = vi.fn().mockImplementation((options) => ({
    description: { title: "problems" },
    options,
  }));
  (MockProblemsContextProvider as any).description = { title: "problems" };
  return { default: MockProblemsContextProvider };
});

vi.mock("../context/providers/RulesContextProvider", () => ({
  default: vi.fn().mockImplementation((options) => ({
    description: { title: "rules" },
    options,
  })),
}));

vi.mock("../context/providers/TerminalContextProvider", () => {
  const MockTerminalContextProvider = vi.fn().mockImplementation((options) => ({
    description: { title: "terminal" },
    options,
  }));
  (MockTerminalContextProvider as any).description = { title: "terminal" };
  return { default: MockTerminalContextProvider };
});

const mockedContextProviderClassFromName =
  contextProviderClassFromName as MockedFunction<
    typeof contextProviderClassFromName
  >;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadConfigContextProviders", () => {
  describe("with empty or undefined config", () => {
    it("should return only default providers when config is undefined", () => {
      const result = loadConfigContextProviders(undefined, false, "vscode");

      expect(result.errors).toEqual([]);
      expect(result.providers).toHaveLength(6);

      // Verify all default providers are included
      const providerTitles = result.providers.map((p) => p.description.title);
      expect(providerTitles).toEqual(
        expect.arrayContaining([
          "file",
          "current-file",
          "diff",
          "terminal",
          "problems",
          "rules",
        ]),
      );
    });

    it("should return only default providers when config is empty array", () => {
      const result = loadConfigContextProviders([], false, "vscode");

      expect(result.errors).toEqual([]);
      expect(result.providers).toHaveLength(6);

      const providerTitles = result.providers.map((p) => p.description.title);
      expect(providerTitles).toEqual(
        expect.arrayContaining([
          "file",
          "current-file",
          "diff",
          "terminal",
          "problems",
          "rules",
        ]),
      );
    });

    it("should exclude problems and terminal in jetbrains", () => {
      const result = loadConfigContextProviders([], false, "jetbrains");

      expect(result.errors).toEqual([]);
      expect(result.providers).toHaveLength(4);

      const providerTitles = result.providers.map((p) => p.description.title);
      expect(providerTitles).toEqual(
        expect.arrayContaining(["file", "current-file", "diff", "rules"]),
      );
    });
  });

  it("should return default + docs when has docs is true", () => {
    const result = loadConfigContextProviders([], true, "vscode");

    expect(result.errors).toEqual([]);
    expect(result.providers).toHaveLength(7);

    const providerTitles = result.providers.map((p) => p.description.title);
    expect(providerTitles).toEqual(
      expect.arrayContaining([
        "file",
        "current-file",
        "diff",
        "terminal",
        "problems",
        "rules",
        "docs",
      ]),
    );
  });
});

describe("with valid config", () => {
  it("should load providers from config with correct parameters", () => {
    const mockProvider = vi.fn().mockImplementation((options) => ({
      description: { title: "custom-provider" },
      options,
    })) as any;

    mockedContextProviderClassFromName.mockReturnValue(mockProvider);

    const config = [
      {
        provider: "custom-provider",
        name: "my-custom-provider",
        params: {
          apiKey: "test-key",
          baseUrl: "https://api.example.com",
        },
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([]);
    expect(mockedContextProviderClassFromName).toHaveBeenCalledWith(
      "custom-provider",
    );
    expect(mockProvider).toHaveBeenCalledWith({
      name: "my-custom-provider",
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
    });

    // Should have custom provider + all defaults
    expect(result.providers).toHaveLength(7);

    const customProvider = result.providers.find(
      (p) => p.description.title === "custom-provider",
    );
    expect(customProvider).toBeDefined();
    expect((customProvider as any)?.options).toEqual({
      name: "my-custom-provider",
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
    });
  });

  it("should handle multiple providers in config", () => {
    const mockProvider1 = vi.fn().mockImplementation((options) => ({
      description: { title: "provider-1" },
      options,
    })) as any;

    const mockProvider2 = vi.fn().mockImplementation((options) => ({
      description: { title: "provider-2" },
      options,
    })) as any;

    mockedContextProviderClassFromName
      .mockReturnValueOnce(mockProvider1)
      .mockReturnValueOnce(mockProvider2);

    const config = [
      {
        provider: "provider-1",
        name: "first-provider",
        params: { setting1: "value1" },
      },
      {
        provider: "provider-2",
        name: "second-provider",
        params: { setting2: "value2" },
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([]);
    expect(result.providers).toHaveLength(8); // 2 custom + 6 defaults

    expect(mockProvider1).toHaveBeenCalledWith({
      name: "first-provider",
      setting1: "value1",
    });

    expect(mockProvider2).toHaveBeenCalledWith({
      name: "second-provider",
      setting2: "value2",
    });
  });

  it("should handle config with empty params", () => {
    const mockProvider = vi.fn().mockImplementation((options) => ({
      description: { title: "no-params-provider" },
      options,
    })) as any;

    mockedContextProviderClassFromName.mockReturnValue(mockProvider);

    const config = [
      {
        provider: "no-params-provider",
        name: "simple-provider",
        params: {},
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([]);
    expect(mockProvider).toHaveBeenCalledWith({
      name: "simple-provider",
    });
  });

  it("should handle config without params property", () => {
    const mockProvider = vi.fn().mockImplementation((options) => ({
      description: { title: "provider-without-params" },
      options,
    })) as any;

    mockedContextProviderClassFromName.mockReturnValue(mockProvider);

    const config = [
      {
        provider: "provider-without-params",
        name: "minimal-provider",
      } as any, // Cast to bypass type checking for test
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([]);
    expect(mockProvider).toHaveBeenCalledWith({
      name: "minimal-provider",
    });
  });
});

describe("error handling", () => {
  it("should add error for unknown provider", () => {
    mockedContextProviderClassFromName.mockReturnValue(undefined);

    const config = [
      {
        provider: "unknown-provider",
        name: "test-provider",
        params: {},
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([
      {
        fatal: false,
        message: "Unknown context provider unknown-provider",
      },
    ]);

    // Should still have default providers
    expect(result.providers).toHaveLength(6);
    expect(mockedContextProviderClassFromName).toHaveBeenCalledWith(
      "unknown-provider",
    );
  });

  it("should handle multiple unknown providers", () => {
    mockedContextProviderClassFromName.mockReturnValue(undefined);

    const config = [
      {
        provider: "unknown-1",
        name: "test-1",
        params: {},
      },
      {
        provider: "unknown-2",
        name: "test-2",
        params: {},
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([
      {
        fatal: false,
        message: "Unknown context provider unknown-1",
      },
      {
        fatal: false,
        message: "Unknown context provider unknown-2",
      },
    ]);

    expect(result.providers).toHaveLength(6); // Only defaults
  });

  it("should handle mix of valid and invalid providers", () => {
    const mockValidProvider = vi.fn().mockImplementation((options) => ({
      description: { title: "valid-provider" },
      options,
    })) as any;

    mockedContextProviderClassFromName
      .mockReturnValueOnce(mockValidProvider)
      .mockReturnValueOnce(undefined);

    const config = [
      {
        provider: "valid-provider",
        name: "valid",
        params: { key: "value" },
      },
      {
        provider: "invalid-provider",
        name: "invalid",
        params: {},
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([
      {
        fatal: false,
        message: "Unknown context provider invalid-provider",
      },
    ]);

    // Should have valid provider + defaults
    expect(result.providers).toHaveLength(7);
    expect(mockValidProvider).toHaveBeenCalledWith({
      name: "valid",
      key: "value",
    });
  });
});

describe("default provider merging", () => {
  it("should not duplicate providers when config matches defaults", () => {
    // Mock FileContextProvider to be returned by contextProviderClassFromName
    mockedContextProviderClassFromName.mockReturnValue(FileContextProvider);

    const config = [
      {
        provider: "file",
        name: "custom-file-provider",
        params: { maxFiles: 100 },
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([]);

    // Should have configured file provider + other defaults (not duplicate file)
    expect(result.providers).toHaveLength(6);

    const fileProviders = result.providers.filter(
      (p) => p.description.title === "file",
    );
    expect(fileProviders).toHaveLength(1);

    // The configured one should be used (with custom params)
    expect(FileContextProvider).toHaveBeenCalledWith({
      name: "custom-file-provider",
      maxFiles: 100,
    });
  });

  it("should add default providers not present in config", () => {
    const mockCustomProvider = vi.fn().mockImplementation((options) => ({
      description: { title: "custom-only" },
      options,
    })) as any;

    mockedContextProviderClassFromName.mockReturnValue(mockCustomProvider);

    const config = [
      {
        provider: "custom-only",
        name: "custom",
        params: {},
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([]);
    expect(result.providers).toHaveLength(7); // 1 custom + 6 defaults

    // All defaults should be present
    const providerTitles = result.providers.map((p) => p.description.title);
    expect(providerTitles).toEqual(
      expect.arrayContaining([
        "custom-only",
        "file",
        "current-file",
        "diff",
        "terminal",
        "problems",
        "rules",
      ]),
    );
  });

  it("should preserve order with configured providers first", () => {
    const mockProvider = vi.fn().mockImplementation((options) => ({
      description: { title: "custom-provider" },
      options,
    })) as any;

    mockedContextProviderClassFromName.mockReturnValue(mockProvider);

    const config = [
      {
        provider: "custom-provider",
        name: "custom",
        params: {},
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.providers[0].description.title).toBe("custom-provider");

    // Rest should be defaults in their original order
    const defaultTitles = result.providers
      .slice(1)
      .map((p) => p.description.title);
    expect(defaultTitles).toEqual([
      "file",
      "current-file",
      "diff",
      "terminal",
      "problems",
      "rules",
    ]);
  });
});

describe("edge cases", () => {
  it("should handle provider constructor throwing error", () => {
    const mockProvider = vi.fn().mockImplementation(() => {
      throw new Error("Provider construction failed");
    }) as any;

    mockedContextProviderClassFromName.mockReturnValue(mockProvider);

    const config = [
      {
        provider: "failing-provider",
        name: "failing",
        params: {},
      },
    ];

    expect(() => loadConfigContextProviders(config, false, "vscode")).toThrow(
      "Provider construction failed",
    );
  });

  it("should handle null provider class", () => {
    mockedContextProviderClassFromName.mockReturnValue(undefined);

    const config = [
      {
        provider: "null-provider",
        name: "null",
        params: {},
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([
      {
        fatal: false,
        message: "Unknown context provider null-provider",
      },
    ]);
  });

  it("should handle provider with same title as default but different implementation", () => {
    // Mock a provider with same title as a default
    const mockFileProvider = vi.fn().mockImplementation((options) => ({
      description: { title: "file" }, // Same title as FileContextProvider
      options,
      customProperty: "custom-implementation",
    })) as any;

    mockedContextProviderClassFromName.mockReturnValue(mockFileProvider);

    const config = [
      {
        provider: "custom-file",
        name: "my-file-provider",
        params: { customParam: "value" },
      },
    ];

    const result = loadConfigContextProviders(config, false, "vscode");

    expect(result.errors).toEqual([]);

    // Should not duplicate - custom implementation should be used
    const fileProviders = result.providers.filter(
      (p) => p.description.title === "file",
    );
    expect(fileProviders).toHaveLength(1);

    const fileProvider = fileProviders[0] as any;
    expect(fileProvider.customProperty).toBe("custom-implementation");
    expect(fileProvider.options).toEqual({
      name: "my-file-provider",
      customParam: "value",
    });
  });
});

describe("provider instantiation", () => {
  it("should call default provider constructors with empty options", () => {
    loadConfigContextProviders([], false, "vscode");

    expect(FileContextProvider).toHaveBeenCalledWith({});
    expect(CurrentFileContextProvider).toHaveBeenCalledWith({});
    expect(DiffContextProvider).toHaveBeenCalledWith({});
    expect(TerminalContextProvider).toHaveBeenCalledWith({});
    expect(ProblemsContextProvider).toHaveBeenCalledWith({});
    expect(RulesContextProvider).toHaveBeenCalledWith({});
  });

  it("should call provider constructors exactly once per provider", () => {
    loadConfigContextProviders([], false, "vscode");

    expect(FileContextProvider).toHaveBeenCalledTimes(1);
    expect(CurrentFileContextProvider).toHaveBeenCalledTimes(1);
    expect(DiffContextProvider).toHaveBeenCalledTimes(1);
    expect(TerminalContextProvider).toHaveBeenCalledTimes(1);
    expect(ProblemsContextProvider).toHaveBeenCalledTimes(1);
    expect(RulesContextProvider).toHaveBeenCalledTimes(1);
  });
});
