import { describe, expect, it, vi } from "vitest";

import type { PackageIdentifier } from "@continuedev/config-yaml";

// Mock heavy dependencies before importing doLoadConfig
const stubConfig = {
  models: [],
  rules: [],
  tools: [],
  slashCommands: [],
  contextProviders: [],
  modelsByRole: { chat: [], edit: [], apply: [], summarize: [], rerank: [] },
  selectedModelByRole: {},
  mcpServerStatuses: [],
  allowAnonymousTelemetry: false,
  experimental: {},
};
const mockLoadYaml = vi.fn().mockResolvedValue({
  config: { ...stubConfig },
  errors: [],
  configLoadInterrupted: false,
});
const mockLoadJson = vi.fn().mockResolvedValue({
  config: { ...stubConfig },
  errors: [],
  configLoadInterrupted: false,
});

vi.mock("../yaml/loadYaml", () => ({
  loadContinueConfigFromYaml: (...args: any[]) => mockLoadYaml(...args),
}));
vi.mock("../load", () => ({
  loadContinueConfigFromJson: (...args: any[]) => mockLoadJson(...args),
}));
vi.mock("../migrateSharedConfig", () => ({
  migrateJsonSharedConfig: vi.fn(),
}));
vi.mock("../getWorkspaceContinueRuleDotFiles", () => ({
  getWorkspaceContinueRuleDotFiles: vi
    .fn()
    .mockResolvedValue({ rules: [], errors: [] }),
}));
vi.mock("../markdown/loadMarkdownRules", () => ({
  loadMarkdownRules: vi.fn().mockResolvedValue({ rules: [], errors: [] }),
}));
vi.mock("../markdown/loadCodebaseRules", () => ({
  CodebaseRulesCache: { getInstance: () => ({ rules: [], errors: [] }) },
}));
vi.mock("../selectedModels", () => ({
  rectifySelectedModelsFromGlobalContext: (c: any) => c,
}));
vi.mock("../../context/mcp/MCPManagerSingleton", () => ({
  MCPManagerSingleton: { getInstance: () => ({ getStatuses: () => [] }) },
}));
vi.mock("../../tools", () => ({
  getConfigDependentToolDefinitions: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../tools/callTool", () => ({
  encodeMCPToolUri: vi.fn(),
}));
vi.mock("../../tools/mcpToolName", () => ({
  getMCPToolName: vi.fn(),
}));
vi.mock("../../util/posthog", () => ({
  Telemetry: { setup: vi.fn() },
}));
vi.mock("../../util/sentry/SentryLogger", () => ({
  SentryLogger: { setup: vi.fn() },
}));
vi.mock("../../util/tts", () => ({
  TTS: { setup: vi.fn() },
}));
vi.mock("../../util/GlobalContext", () => ({
  GlobalContext: class {
    get() {
      return {};
    }
    update() {}
  },
}));
vi.mock("../../control-plane/env", () => ({
  getControlPlaneEnv: vi.fn().mockResolvedValue({
    DEFAULT_CONTROL_PLANE_PROXY_URL: "https://proxy.example.com/",
  }),
  getControlPlaneEnvSync: vi.fn().mockReturnValue({
    CONTROL_PLANE_URL: "https://api.example.com/",
  }),
}));
vi.mock("../../control-plane/PolicySingleton", () => ({
  PolicySingleton: { getInstance: () => ({ policy: null }) },
}));
vi.mock("../../control-plane/TeamAnalytics", () => ({
  TeamAnalytics: { setup: vi.fn(), shutdown: vi.fn() },
}));
vi.mock("../../promptFiles/initPrompt", () => ({
  initSlashCommand: { name: "init", description: "init" },
}));

// Mock fs.existsSync to simulate missing file on disk
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(false),
    },
  };
});

import doLoadConfig from "./doLoadConfig.js";

const mockIde = {
  getIdeInfo: vi.fn().mockResolvedValue({
    ideType: "vscode",
    name: "VS Code",
    version: "1.90.0",
    remoteName: "wsl",
    extensionVersion: "1.3.31",
  }),
  getUniqueId: vi.fn().mockResolvedValue("test-id"),
  getIdeSettings: vi.fn().mockResolvedValue({}),
  showToast: vi.fn(),
  isTelemetryEnabled: vi.fn().mockResolvedValue(true),
  isWorkspaceRemote: vi.fn().mockResolvedValue(true),
} as any;

const mockControlPlaneClient = {
  getAccessToken: vi.fn().mockResolvedValue("token"),
  isSignedIn: vi.fn().mockResolvedValue(false),
  sessionInfoPromise: Promise.resolve(undefined),
} as any;

const mockLlmLogger = {} as any;

describe("doLoadConfig pre-read content bypass", () => {
  it("should use YAML loading when packageIdentifier has pre-read content, even if file does not exist on disk", async () => {
    mockLoadYaml.mockClear();
    mockLoadJson.mockClear();

    const packageIdentifier: PackageIdentifier = {
      uriType: "file",
      fileUri:
        "vscode-remote://wsl+Ubuntu/home/user/.continue/agents/test.yaml",
      content: "name: Test\nversion: 1.0.0\nschema: v1\n",
    };

    await doLoadConfig({
      ide: mockIde,
      controlPlaneClient: mockControlPlaneClient,
      llmLogger: mockLlmLogger,
      profileId: "test-profile",
      overrideConfigYamlByPath: packageIdentifier.fileUri,
      orgScopeId: null,
      packageIdentifier,
    });

    expect(mockLoadYaml).toHaveBeenCalled();
    expect(mockLoadJson).not.toHaveBeenCalled();
  });

  it("should fall back to JSON loading when no content and file does not exist", async () => {
    mockLoadYaml.mockClear();
    mockLoadJson.mockClear();

    const packageIdentifier: PackageIdentifier = {
      uriType: "file",
      fileUri:
        "vscode-remote://wsl+Ubuntu/home/user/.continue/agents/test.yaml",
    };

    await doLoadConfig({
      ide: mockIde,
      controlPlaneClient: mockControlPlaneClient,
      llmLogger: mockLlmLogger,
      profileId: "test-profile",
      overrideConfigYamlByPath: packageIdentifier.fileUri,
      orgScopeId: null,
      packageIdentifier,
    });

    expect(mockLoadYaml).not.toHaveBeenCalled();
    expect(mockLoadJson).toHaveBeenCalled();
  });
});

describe("doLoadConfig tabAutocompleteModel migration", () => {
  it("should transform a JSON-style tabAutocompleteModel object into a roles-based model entry", async () => {
    mockLoadYaml.mockClear();
    mockLoadJson.mockClear();
    (mockIde.showToast as ReturnType<typeof vi.fn>).mockClear();

    // Simulate a config.yaml with the legacy config.json-style tabAutocompleteModel
    const yamlWithLegacyField = [
      "name: My Config",
      "version: 1.0.0",
      "schema: v1",
      "models:",
      "  - name: ChatModel",
      "    provider: openai",
      "    model: gpt-4",
      "tabAutocompleteModel:",
      "  name: Qwen 2.5 Coder",
      "  provider: openai",
      "  model: qwen2.5-coder:1.5b",
      "  apiBase: http://localhost:11434/v1",
    ].join("\n");

    const packageIdentifier: PackageIdentifier = {
      uriType: "file",
      fileUri: "/home/user/.continue/config.yaml",
      content: yamlWithLegacyField,
    };

    await doLoadConfig({
      ide: mockIde,
      controlPlaneClient: mockControlPlaneClient,
      llmLogger: mockLlmLogger,
      profileId: "test-profile",
      orgScopeId: null,
      packageIdentifier,
    });

    expect(mockLoadYaml).toHaveBeenCalled();
    const calledWith = mockLoadYaml.mock.calls[0][0];
    const passedContent = calledWith.packageIdentifier.content as string;

    // The transformed content should not contain tabAutocompleteModel
    expect(passedContent).not.toContain("tabAutocompleteModel");

    // The autocomplete model should have been injected with roles: [autocomplete]
    expect(passedContent).toContain("qwen2.5-coder:1.5b");
    expect(passedContent).toContain("autocomplete");

    // A deprecation warning toast should have been shown
    expect(mockIde.showToast).toHaveBeenCalledWith(
      "warning",
      expect.stringContaining("tabAutocompleteModel"),
    );
  });

  it("should leave config unchanged when tabAutocompleteModel is absent", async () => {
    mockLoadYaml.mockClear();
    (mockIde.showToast as ReturnType<typeof vi.fn>).mockClear();

    const yamlWithoutLegacyField = [
      "name: My Config",
      "version: 1.0.0",
      "schema: v1",
      "models:",
      "  - name: ChatModel",
      "    provider: openai",
      "    model: gpt-4",
      "  - name: Qwen 2.5 Coder",
      "    provider: openai",
      "    model: qwen2.5-coder:1.5b",
      "    roles:",
      "      - autocomplete",
    ].join("\n");

    const packageIdentifier: PackageIdentifier = {
      uriType: "file",
      fileUri: "/home/user/.continue/config.yaml",
      content: yamlWithoutLegacyField,
    };

    await doLoadConfig({
      ide: mockIde,
      controlPlaneClient: mockControlPlaneClient,
      llmLogger: mockLlmLogger,
      profileId: "test-profile",
      orgScopeId: null,
      packageIdentifier,
    });

    const calledWith = mockLoadYaml.mock.calls[0][0];
    // Content should be passed through unmodified (same object reference)
    expect(calledWith.packageIdentifier).toBe(packageIdentifier);
    expect(mockIde.showToast).not.toHaveBeenCalled();
  });

  it("should leave config unchanged when tabAutocompleteModel is an array", async () => {
    mockLoadYaml.mockClear();
    (mockIde.showToast as ReturnType<typeof vi.fn>).mockClear();

    // An array is typeof "object" but must not be treated as an inline model
    const yamlWithArray = [
      "name: My Config",
      "version: 1.0.0",
      "schema: v1",
      "tabAutocompleteModel:",
      "  - name: Qwen",
      "    provider: openai",
      "    model: qwen2.5-coder:1.5b",
    ].join("\n");

    const packageIdentifier: PackageIdentifier = {
      uriType: "file",
      fileUri: "/home/user/.continue/config.yaml",
      content: yamlWithArray,
    };

    await doLoadConfig({
      ide: mockIde,
      controlPlaneClient: mockControlPlaneClient,
      llmLogger: mockLlmLogger,
      profileId: "test-profile",
      orgScopeId: null,
      packageIdentifier,
    });

    const calledWith = mockLoadYaml.mock.calls[0][0];
    expect(calledWith.packageIdentifier).toBe(packageIdentifier);
    expect(mockIde.showToast).not.toHaveBeenCalled();
  });
});
