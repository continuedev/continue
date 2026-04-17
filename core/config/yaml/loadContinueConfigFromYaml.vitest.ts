import { describe, expect, it, vi } from "vitest";

const { mockApplyConfigTsAndRemoteConfig } = vi.hoisted(() => ({
  mockApplyConfigTsAndRemoteConfig: vi.fn(async ({ config }) => ({
    ...config,
    allowAnonymousTelemetry: false,
  })),
}));

vi.mock("../load", () => ({
  applyConfigTsAndRemoteConfig: mockApplyConfigTsAndRemoteConfig,
}));

vi.mock("../../context/mcp/MCPManagerSingleton", () => ({
  MCPManagerSingleton: {
    getInstance: () => ({
      setConnections: vi.fn(),
      shutdown: vi.fn(),
      getStatuses: () => [],
    }),
  },
}));

vi.mock("../../promptFiles/getPromptFiles", () => ({
  getAllPromptFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../context/mcp/json/loadJsonMcpConfigs", () => ({
  loadJsonMcpConfigs: vi.fn().mockResolvedValue({ errors: [], mcpServers: [] }),
}));

vi.mock("../../tools", () => ({
  getBaseToolDefinitions: vi.fn().mockReturnValue([]),
}));

vi.mock("../loadContextProviders", () => ({
  loadConfigContextProviders: vi.fn().mockReturnValue({
    providers: [],
    errors: [],
  }),
}));

vi.mock("../loadLocalAssistants", () => ({
  getAllDotContinueDefinitionFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock("./models", () => ({
  llmsFromModelConfig: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../util/GlobalContext", () => ({
  GlobalContext: class {
    getSharedConfig() {
      return {};
    }

    get() {
      return {};
    }

    update() {}
  },
}));

vi.mock("../../control-plane/env", () => ({
  getControlPlaneEnvSync: vi.fn().mockReturnValue({
    CONTROL_PLANE_URL: "https://api.example.com",
  }),
}));

vi.mock("../../control-plane/PolicySingleton", () => ({
  PolicySingleton: {
    getInstance: () => ({ policy: null }),
  },
}));

import { loadContinueConfigFromYaml } from "./loadYaml";

describe("loadContinueConfigFromYaml", () => {
  it("applies config.ts modifiers for YAML configs", async () => {
    const result = await loadContinueConfigFromYaml({
      ide: {} as any,
      ideSettings: {
        remoteConfigServerUrl: "",
        remoteConfigSyncPeriod: 60,
        userToken: "",
        continueTestEnvironment: "none",
        pauseCodebaseIndexOnStart: false,
      },
      ideInfo: { ideType: "vscode" } as any,
      uniqueId: "test-unique-id",
      llmLogger: {} as any,
      workOsAccessToken: undefined,
      overrideConfigYaml: {
        name: "Local Config",
        version: "1.0.0",
        schema: "v1",
        models: [],
      },
      controlPlaneClient: {
        getAccessToken: vi.fn(),
      } as any,
      orgScopeId: null,
      packageIdentifier: {
        uriType: "file",
        fileUri: "/tmp/config.yaml",
        content: "name: Local Config\nversion: 1.0.0\nschema: v1\n",
      },
    });

    expect(mockApplyConfigTsAndRemoteConfig).toHaveBeenCalledTimes(1);
    expect(result.config?.allowAnonymousTelemetry).toBe(false);
  });
});
