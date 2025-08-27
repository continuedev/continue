import {
  AssistantUnrolled,
  AssistantUnrolledNonNullable,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDE, IdeInfo, IdeSettings, ILLMLogger } from "../..";
import { configYamlToContinueConfig } from "./loadYaml";

// Mock dependencies
vi.mock("../../tools", () => ({
  getToolsForIde: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../context/mcp/MCPManagerSingleton", () => ({
  MCPManagerSingleton: {
    getInstance: vi.fn().mockReturnValue({
      setConnections: vi.fn(),
    }),
  },
}));

vi.mock("../loadContextProviders", () => ({
  loadConfigContextProviders: vi
    .fn()
    .mockReturnValue({ providers: [], errors: [] }),
}));

vi.mock("../../promptFiles/getPromptFiles", () => ({
  getAllPromptFiles: vi.fn().mockResolvedValue([]),
}));

// Create mock functions
const createMockIDE = (): IDE =>
  ({
    getWorkspaceConfigs: vi.fn().mockResolvedValue([]),
    getWorkspaceDirs: vi.fn().mockResolvedValue([]),
  }) as any;

const createMockIdeSettings = (): IdeSettings => ({
  remoteConfigServerUrl: undefined,
  remoteConfigSyncPeriod: 60,
  userToken: "",
  continueTestEnvironment: "local",
  pauseCodebaseIndexOnStart: true,
});

const createMockLLMLogger = (): ILLMLogger =>
  ({
    log: vi.fn(),
  }) as any;

describe("configYamlToContinueConfig", () => {
  let mockIde: IDE;
  const mockIdeInfo: IdeInfo = {
    isPrerelease: false,
    ideType: "jetbrains",
    extensionVersion: "1.0.0",
    name: "Intellij",
    remoteName: "",
    version: "",
  };
  let mockIdeSettings: IdeSettings;
  let mockLLMLogger: ILLMLogger;

  beforeEach(() => {
    mockIde = createMockIDE();
    mockIdeSettings = createMockIdeSettings();
    mockLLMLogger = createMockLLMLogger();
    vi.clearAllMocks();
  });

  describe("requestOptions merging", () => {
    const baseRequestOptions = {
      timeout: 30000,
      headers: {
        "User-Agent": "Continue/1.0.0",
      },
      proxy: "global-proxy",
    };

    it("should merge requestOptions for data items with top-level requestOptions", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: baseRequestOptions,
        data: [
          {
            name: "test-data",
            destination: "data-destination",
            requestOptions: {
              timeout: 60000,
              headers: {
                Authorization: "Bearer token123",
              },
            },
            schema: "v2",
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      expect(result.config.data).toHaveLength(1);
      const dataItem = result.config.data![0];

      // Should have merged requestOptions with data-specific options taking precedence
      expect(dataItem.requestOptions).toEqual({
        timeout: 60000, // data-specific value takes precedence
        headers: {
          "User-Agent": "Continue/1.0.0", // from top-level
          Authorization: "Bearer token123", // from data-specific
        },
        proxy: "global-proxy", // from top-level
      });
    });

    it("should use top-level requestOptions when data item has no requestOptions", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: baseRequestOptions,
        data: [
          {
            name: "test-data",
            destination: "continue-destination",
            schema: "v2",
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      const dataItem = result.config.data![0];
      expect(dataItem.requestOptions).toEqual(baseRequestOptions);
    });

    it("should merge requestOptions for MCP servers with top-level requestOptions", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: baseRequestOptions,
        mcpServers: [
          {
            name: "test-mcp",
            command: "node",
            args: ["server.js"],
            requestOptions: {
              timeout: 45000,
              headers: {
                "X-Custom-Header": "mcp-value",
              },
              proxy: "mcp-proxy",
            },
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      // Check that MCP manager was called with merged requestOptions
      const { MCPManagerSingleton } = await import(
        "../../context/mcp/MCPManagerSingleton"
      );
      const mockManager = MCPManagerSingleton.getInstance();

      expect(mockManager.setConnections).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "test-mcp",
            name: "test-mcp",
            sourceFile: undefined,
            timeout: undefined,
            transport: expect.objectContaining({
              name: "test-mcp",
              command: "node",
              args: ["server.js"],
              requestOptions: {
                timeout: 45000, // MCP-specific value takes precedence
                headers: {
                  "User-Agent": "Continue/1.0.0", // from top-level
                  "X-Custom-Header": "mcp-value", // from MCP-specific
                },
                proxy: "mcp-proxy", // MCP-specific value takes precedence
              },
            }),
            type: "stdio",
          }),
        ]),
        false,
        { ide: mockIde },
      );
    });

    it("should use top-level requestOptions when MCP server has no requestOptions", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: baseRequestOptions,
        mcpServers: [
          {
            name: "test-mcp",
            command: "node",
            args: ["server.js"],
            // no requestOptions specified
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      const { MCPManagerSingleton } = await import(
        "../../context/mcp/MCPManagerSingleton"
      );
      const mockManager = MCPManagerSingleton.getInstance();

      expect(mockManager.setConnections).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            transport: expect.objectContaining({
              requestOptions: baseRequestOptions,
            }),
          }),
        ]),
        false,
        { ide: mockIde },
      );
    });

    it("should handle nested header merging correctly", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: {
          headers: {
            "User-Agent": "Continue/1.0.0",
            Accept: "application/json",
          },
        },
        data: [
          {
            name: "test-data",
            destination: "continue-destination",
            requestOptions: {
              headers: {
                Authorization: "Bearer token123",
                Accept: "application/xml", // Should override top-level
              },
            },
            schema: "v2",
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      const dataItem = result.config.data![0];
      expect(dataItem.requestOptions?.headers).toEqual({
        "User-Agent": "Continue/1.0.0",
        Accept: "application/xml", // data-specific value takes precedence
        Authorization: "Bearer token123",
      });
    });

    it("should handle empty headers correctly", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: {
          timeout: 30000,
          headers: {},
        },
        data: [
          {
            name: "test-data",
            destination: "continue-destination",
            requestOptions: {
              headers: {},
            },
            schema: "v2",
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      const dataItem = result.config.data![0];
      // When headers is empty object after merge, it should be undefined
      expect(dataItem.requestOptions?.headers).toBeUndefined();
    });

    it("should handle multiple data items with different requestOptions", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: {
          timeout: 30000,
          headers: {
            "User-Agent": "Continue/1.0.0",
          },
        },
        data: [
          {
            name: "data1",
            destination: "destination-1",
            requestOptions: {
              timeout: 60000,
            },
            schema: "v2",
          },
          {
            name: "data2",
            destination: "destination-2",
            requestOptions: {
              headers: {
                Authorization: "Bearer token",
              },
            },
            schema: "v2",
          },
          {
            name: "data3",
            destination: "destination-3",
            schema: "v2",
            // no requestOptions
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      expect(result.config.data).toHaveLength(3);

      // First data item: timeout override
      expect(result.config.data![0].requestOptions).toEqual({
        timeout: 60000,
        headers: {
          "User-Agent": "Continue/1.0.0",
        },
      });

      // Second data item: headers merge
      expect(result.config.data![1].requestOptions).toEqual({
        timeout: 30000,
        headers: {
          "User-Agent": "Continue/1.0.0",
          Authorization: "Bearer token",
        },
      });

      // Third data item: use top-level options
      expect(result.config.data![2].requestOptions).toEqual({
        timeout: 30000,
        headers: {
          "User-Agent": "Continue/1.0.0",
        },
      });
    });

    it("should handle undefined top-level requestOptions", async () => {
      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        // no requestOptions at top level
        data: [
          {
            name: "test-data",
            destination: "continue-destination",
            requestOptions: {
              timeout: 60000,
            },
            schema: "v2",
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      const dataItem = result.config.data![0];
      expect(dataItem.requestOptions).toEqual({
        timeout: 60000,
      });
    });
  });
  describe("model requestOptions merging", () => {
    // Mock the llmsFromModelConfig function to test that it receives merged requestOptions
    vi.mock("./models", () => ({
      llmsFromModelConfig: vi.fn().mockResolvedValue([]),
    }));

    it("should pass top-level requestOptions to ContinueConfig", async () => {
      const requestOptions = {
        timeout: 30000,
        headers: {
          "User-Agent": "Continue/1.0.0",
        },
      };

      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions,
        models: [
          {
            name: "test-model",
            provider: "openai",
            model: "gpt-4",
          },
        ],
      };

      const result = await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      expect(result.config.requestOptions).toEqual(requestOptions);
    });

    it("should call llmsFromModelConfig with merged requestOptions", async () => {
      const { llmsFromModelConfig } = await import("./models");

      const topLevelRequestOptions = {
        timeout: 30000,
        headers: {
          "User-Agent": "Continue/1.0.0",
        },
      };

      const modelRequestOptions = {
        timeout: 60000,
        headers: {
          Authorization: "Bearer token",
        },
      };

      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: topLevelRequestOptions,
        models: [
          {
            name: "test-model",
            provider: "openai",
            model: "gpt-4",
            requestOptions: modelRequestOptions,
          },
        ],
      };

      await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      // Verify that llmsFromModelConfig was called with the ContinueConfig containing top-level requestOptions
      expect(llmsFromModelConfig).toHaveBeenCalledWith({
        model: expect.objectContaining({
          name: "test-model",
          provider: "openai",
          model: "gpt-4",
          requestOptions: modelRequestOptions,
        }),
        ide: mockIde,
        uniqueId: "test-id",
        ideSettings: mockIdeSettings,
        llmLogger: mockLLMLogger,
        config: expect.objectContaining({
          requestOptions: topLevelRequestOptions,
        }),
      });
    });

    it("should handle model without requestOptions", async () => {
      const { llmsFromModelConfig } = await import("./models");

      const topLevelRequestOptions = {
        timeout: 30000,
        headers: {
          "User-Agent": "Continue/1.0.0",
        },
      };

      const config: AssistantUnrolled = {
        name: "test-agent",
        version: "1.0.0",
        requestOptions: topLevelRequestOptions,
        models: [
          {
            name: "test-model",
            provider: "openai",
            model: "gpt-4",
            // no requestOptions
          },
        ],
      };

      await configYamlToContinueConfig({
        config,
        ide: mockIde,
        ideSettings: mockIdeSettings,
        ideInfo: mockIdeInfo,
        uniqueId: "test-id",
        llmLogger: mockLLMLogger,
        workOsAccessToken: undefined,
      });

      // Verify that llmsFromModelConfig was called with the model having no requestOptions
      // but the config containing top-level requestOptions
      expect(llmsFromModelConfig).toHaveBeenCalledWith({
        model: expect.objectContaining({
          name: "test-model",
          provider: "openai",
          model: "gpt-4",
          // requestOptions should be undefined for the model
        }),
        ide: mockIde,
        uniqueId: "test-id",
        ideSettings: mockIdeSettings,
        llmLogger: mockLLMLogger,
        config: expect.objectContaining({
          requestOptions: topLevelRequestOptions,
        }),
      });

      // Ensure the model doesn't have requestOptions
      const callArgs = (llmsFromModelConfig as any).mock.calls[0][0];
      expect(callArgs.model).not.toHaveProperty("requestOptions");
    });
  });
});

describe("MCP Server cwd configuration", () => {
  describe("YAML schema validation", () => {
    it("should accept valid MCP server with cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "node",
            args: ["server.js"],
            env: { NODE_ENV: "production" },
            cwd: "/path/to/project",
            connectionTimeout: 5000,
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept MCP server without cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "python",
            args: ["-m", "server"],
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept relative paths in cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "cargo",
            args: ["run"],
            cwd: "./rust-project",
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept empty string cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "deno",
            args: ["run", "server.ts"],
            cwd: "",
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe("MCP server configuration examples", () => {
    it("should support common MCP server patterns with cwd", () => {
      const configs = [
        {
          name: "Local project MCP server",
          server: {
            name: "project-mcp",
            command: "npm",
            args: ["run", "mcp-server"],
            cwd: "/Users/developer/my-project",
          },
        },
        {
          name: "Python MCP with virtual environment",
          server: {
            name: "python-mcp",
            command: "python",
            args: ["-m", "my_mcp_server"],
            env: { PYTHONPATH: "./src" },
            cwd: "/home/user/python-project",
          },
        },
        {
          name: "Relative path MCP server",
          server: {
            name: "relative-mcp",
            command: "node",
            args: ["index.js"],
            cwd: "../mcp-servers/filesystem",
          },
        },
      ];

      configs.forEach(({ name, server }) => {
        const config: AssistantUnrolledNonNullable = {
          name: "test-agent",
          version: "1.0.0",
          mcpServers: [server],
        };

        const errors = validateConfigYaml(config);
        expect(errors).toHaveLength(0);
      });
    });
  });
});
