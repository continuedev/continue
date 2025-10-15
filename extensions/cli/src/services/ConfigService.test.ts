import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock modules
vi.mock("../auth/workos.js");
vi.mock("../configLoader.js");
vi.mock("../util/logger.js");
vi.mock("./ServiceContainer.js");
vi.mock("@continuedev/config-yaml");
// Don't mock hubLoader - use real isStringRule implementation

import {
  decodePackageIdentifier,
  mergeUnrolledAssistants,
} from "@continuedev/config-yaml";
import * as workos from "../auth/workos.js";
import * as configLoader from "../configLoader.js";

import { ConfigService } from "./ConfigService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { AgentFileServiceState, SERVICE_NAMES } from "./types.js";

describe("ConfigService", () => {
  let service: ConfigService;
  const mockConfig = {
    name: "test-assistant",
    version: "1.0.0",
    models: [],
    systemMessage: "Test system message",
  } as any;
  const mockApiClient = { get: vi.fn(), post: vi.fn() };
  const mockAgentFileState: AgentFileServiceState = {
    slug: null,
    agentFile: null,
    agentFileModel: null,
    parsedRules: null,
    parsedTools: null,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConfigService();

    // Setup mocks
    vi.mocked(mergeUnrolledAssistants).mockReturnValue(mockConfig as any);
    vi.mocked(decodePackageIdentifier).mockImplementation((id) => ({
      uriType: "slug",
      fullSlug: {
        ownerSlug: "owner",
        packageSlug: "package",
        versionSlug: "version",
      },
    }));
  });

  describe("State Management", () => {
    test("should initialize with config from path", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/path/to/config.yaml" } as any,
      });

      const state = await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/path/to/config.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      expect(state).toEqual({
        config: mockConfig as any,
        configPath: "/path/to/config.yaml",
      });
      expect(vi.mocked(mergeUnrolledAssistants)).toHaveBeenCalledWith(
        mockConfig,
        expect.objectContaining({
          name: "hidden",
          version: "1.0.0",
          rules: [],
          mcpServers: [],
          prompts: [],
        }),
      );
    });

    test("should initialize with undefined config path", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "default-agent" } as any,
      });

      const state = await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: undefined,
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      expect(state).toEqual({
        config: mockConfig as any,
        configPath: undefined,
      });
    });

    test("should inject rules into config using mergeUnrolledAssistants", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/config.yaml" } as any,
      });

      const expectedConfig = {
        ...mockConfig,
        rules: ["rule1", "rule2"],
      };

      vi.mocked(mergeUnrolledAssistants).mockReturnValue(expectedConfig);

      const state = await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/config.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
        injectedConfigOptions: { rule: ["rule1", "rule2"] },
      });

      // Verify mergeUnrolledAssistants was called with the right parameters
      expect(vi.mocked(mergeUnrolledAssistants)).toHaveBeenCalledWith(
        mockConfig,
        expect.objectContaining({
          name: "hidden",
          version: "1.0.0",
          rules: ["rule1", "rule2"],
          mcpServers: [],
          prompts: [],
        }),
      );

      expect(state.config).toEqual(expectedConfig);
    });
  });

  describe("switchConfig()", () => {
    test("should switch to new configuration", async () => {
      // Initialize first
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/old.yaml" } as any,
      });
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/old.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      // Switch to new config
      const newConfig = { ...mockConfig, name: "new-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: newConfig,
        source: { type: "cli-flag", path: "/new.yaml" } as any,
      });
      vi.mocked(mergeUnrolledAssistants).mockReturnValue(newConfig);

      const state = await service.switchConfig({
        authConfig: { accessToken: "token" } as any,
        configPath: "/new.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      expect(state).toEqual({
        config: newConfig,
        configPath: "/new.yaml",
      });
      expect(service.getState()).toEqual(state);
    });

    test("should handle switch config errors", async () => {
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/old.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      vi.mocked(configLoader.loadConfiguration).mockRejectedValue(
        new Error("Config not found"),
      );

      await expect(
        service.switchConfig({
          authConfig: { accessToken: "token" } as any,
          configPath: "/bad.yaml",
          apiClient: mockApiClient as any,
          agentFileState: mockAgentFileState,
        }),
      ).rejects.toThrow("Config not found");
    });
  });

  describe("reload()", () => {
    test("should reload current configuration", async () => {
      // Initialize with a config
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/config.yaml" } as any,
      });
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/config.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      // Modify mock to return updated config
      const updatedConfig = { ...mockConfig, name: "updated-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: updatedConfig,
        source: { type: "cli-flag", path: "/config.yaml" } as any,
      });
      vi.mocked(mergeUnrolledAssistants).mockReturnValue(updatedConfig);

      const state = await service.reload({
        authConfig: { accessToken: "token" } as any,
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      expect(state).toEqual({
        config: updatedConfig,
        configPath: "/config.yaml",
      });
    });

    test("should throw error if no config path available", async () => {
      // Initialize without config path
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "default-agent" } as any,
      });
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: undefined,
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      await expect(
        service.reload({
          authConfig: { accessToken: "token" } as any,
          apiClient: mockApiClient as any,
          agentFileState: mockAgentFileState,
        }),
      ).rejects.toThrow("No configuration path available for reload");
    });
  });

  describe("updateConfigPath()", () => {
    test("should update config path and reload dependent services", async () => {
      // Initialize service first
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/old.yaml" } as any,
      });
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/old.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      // Mock service container
      vi.mocked(workos.loadAuthConfig).mockReturnValue({
        accessToken: "token",
        organizationId: "org-123",
      } as any);
      vi.mocked(serviceContainer.get)
        .mockResolvedValueOnce({ apiClient: mockApiClient })
        .mockResolvedValueOnce(mockAgentFileState);

      // Mock new config load
      const newConfig = { ...mockConfig, name: "new-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: newConfig,
        source: { type: "cli-flag", path: "/new.yaml" } as any,
      });
      vi.mocked(mergeUnrolledAssistants).mockReturnValue(newConfig);

      await service.updateConfigPath("/new.yaml");

      expect(service.getState()).toEqual({
        config: newConfig,
        configPath: "/new.yaml",
      });
      expect(vi.mocked(serviceContainer.set)).toHaveBeenCalledWith(
        SERVICE_NAMES.CONFIG,
        expect.objectContaining({ config: newConfig }),
      );
      expect(vi.mocked(serviceContainer.reload)).toHaveBeenCalledWith(
        SERVICE_NAMES.MODEL,
      );
      expect(vi.mocked(serviceContainer.reload)).toHaveBeenCalledWith(
        SERVICE_NAMES.MCP,
      );
    });

    test("should handle missing API client", async () => {
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/old.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      vi.mocked(workos.loadAuthConfig).mockReturnValue({
        accessToken: "token",
        organizationId: "org-123",
      } as any);
      vi.mocked(serviceContainer.get).mockResolvedValue({
        apiClient: null,
      });

      await expect(service.updateConfigPath("/new.yaml")).rejects.toThrow(
        "API client not available",
      );
    });
  });

  describe("getAdditionalBlocksFromOptions()", () => {
    test("should process command line options correctly", () => {
      const options = {
        rule: ["rule1", "owner/package-rule"],
        prompt: ["prompt1"],
        model: ["gpt-4"],
        mcp: ["owner/mcp-server", "https://example.com/mcp"],
      };
      const agentFileState = {
        agentFile: {
          name: "test-agent",
          model: "agent-model",
          prompt: "Agent prompt",
        },
        parsedRules: ["agent/rule"],
        parsedTools: {
          mcpServers: ["agent/mcp"],
        },
      } as any;

      const result = service.getAdditionalBlocksFromOptions(
        options,
        agentFileState,
      );

      // Should have package identifiers from models, MCPs, and non-string rules
      expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith("gpt-4");
      expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
        "agent-model",
      );
      expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
        "owner/package-rule",
      );
      expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
        "owner/mcp-server",
      );
      expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
        "agent/rule",
      );
      expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
        "agent/mcp",
      );

      // Should have additional blocks with string rules and URL MCPs
      expect(result.additional.rules).toContain("rule1");
      expect(result.additional.rules).toContain("prompt1");
      expect(result.additional.mcpServers).toEqual([
        expect.objectContaining({
          name: "example.com",
          url: "https://example.com/mcp",
        }),
      ]);
      expect(result.additional.prompts).toEqual([
        expect.objectContaining({
          name: "Agent prompt (test-agent)",
          prompt: "Agent prompt",
        }),
      ]);
    });

    test("should handle empty options", () => {
      const result = service.getAdditionalBlocksFromOptions(
        undefined,
        undefined,
      );

      expect(result.injected).toEqual([]);
      expect(result.additional).toEqual({
        name: "hidden",
        version: "1.0.0",
        rules: [],
        mcpServers: [],
        prompts: [],
      });
    });
  });

  describe("getDependencies()", () => {
    test("should declare auth, apiClient, and agentFile dependencies", () => {
      expect(service.getDependencies()).toEqual([
        SERVICE_NAMES.AUTH,
        SERVICE_NAMES.API_CLIENT,
        SERVICE_NAMES.AGENT_FILE,
      ]);
    });
  });

  describe("Event Emission", () => {
    test("should emit stateChanged when switching config", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/old.yaml" } as any,
      });
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/old.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      const listener = vi.fn();
      service.on("stateChanged", listener);

      const newConfig = { ...mockConfig, name: "new-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: newConfig,
        source: { type: "cli-flag", path: "/new.yaml" } as any,
      });
      vi.mocked(mergeUnrolledAssistants).mockReturnValue(newConfig);

      await service.switchConfig({
        authConfig: { accessToken: "token" } as any,
        configPath: "/new.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ config: newConfig, configPath: "/new.yaml" }),
        expect.objectContaining({
          config: mockConfig,
          configPath: "/old.yaml",
        }),
      );
    });

    test("should emit error on switch failure", async () => {
      await service.doInitialize({
        authConfig: { accessToken: "token" } as any,
        configPath: "/old.yaml",
        apiClient: mockApiClient as any,
        agentFileState: mockAgentFileState,
      });

      const errorListener = vi.fn();
      service.on("error", errorListener);

      const error = new Error("Config load failed");
      vi.mocked(configLoader.loadConfiguration).mockRejectedValue(error);

      await expect(
        service.switchConfig({
          authConfig: { accessToken: "token" } as any,
          configPath: "/bad.yaml",
          apiClient: mockApiClient as any,
          agentFileState: mockAgentFileState,
        }),
      ).rejects.toThrow();
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });

  describe("Legacy Compatibility", () => {
    test("updateConfigPath method exists and has correct signature", () => {
      // Test that the updateConfigPath method exists and is a function
      expect(typeof service.updateConfigPath).toBe("function");

      // Test that it accepts the correct parameter types
      const method = service.updateConfigPath;
      expect(method).toBeInstanceOf(Function);
      expect(method.length).toBe(1); // Should accept 1 parameter
    });

    test("ConfigService has reactive pattern implementation", () => {
      // Verify that ConfigService has the updateConfigPath method
      // which is the key method for reactive config switching
      expect(service).toHaveProperty("updateConfigPath");
      expect(typeof service.updateConfigPath).toBe("function");

      // The method signature should accept string | undefined
      // This confirms the reactive pattern is implemented
      expect(service.updateConfigPath.length).toBe(1);
    });
  });
});
