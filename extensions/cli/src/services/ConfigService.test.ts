import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock modules
vi.mock("../auth/workos.js");
vi.mock("../configLoader.js");
vi.mock("../configEnhancer.js");
vi.mock("./ServiceContainer.js");

import * as workos from "../auth/workos.js";
import { configEnhancer } from "../configEnhancer.js";
import * as configLoader from "../configLoader.js";

import { ConfigService } from "./ConfigService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { SERVICE_NAMES } from "./types.js";

describe("ConfigService", () => {
  let service: ConfigService;
  const mockConfig = {
    name: "test-assistant",
    version: "1.0.0",
    models: [],
    systemMessage: "Test system message",
  } as any;
  const mockApiClient = { get: vi.fn(), post: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConfigService();
  });

  describe("State Management", () => {
    test("should initialize with config from path", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/path/to/config.yaml" } as any,
      });

      const state = await service.initialize(
        { accessToken: "token" } as any,
        "/path/to/config.yaml",
        "org-123",
        mockApiClient as any,
      );

      expect(state).toEqual({
        config: mockConfig as any,
        configPath: "/path/to/config.yaml",
      });
    });

    test("should initialize with undefined config path", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "default-agent" } as any,
      });

      const state = await service.initialize(
        { accessToken: "token" } as any,
        undefined,
        "org-123",
        mockApiClient as any,
      );

      expect(state).toEqual({
        config: mockConfig as any,
        configPath: undefined,
      });
    });

    test("should inject rules into config", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/config.yaml" } as any,
      });

      const expectedConfig = {
        ...mockConfig,
        systemMessage:
          "Test system message\n\nProcessed: rule1\n\nProcessed: rule2",
      };

      vi.mocked(configEnhancer.enhanceConfig).mockResolvedValue(expectedConfig);

      const state = await service.initialize(
        { accessToken: "token" } as any,
        "/config.yaml",
        "org-123",
        mockApiClient as any,
        { rule: ["rule1", "rule2"] },
      );

      // Verify configEnhancer was called with the right parameters
      expect(vi.mocked(configEnhancer.enhanceConfig)).toHaveBeenCalledWith(
        mockConfig,
        { rule: ["rule1", "rule2"] },
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
      await service.initialize(
        { accessToken: "token" } as any,
        "/old.yaml",
        "org-123",
        mockApiClient as any,
      );

      // Switch to new config
      const newConfig = { ...mockConfig, name: "new-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: newConfig,
        source: { type: "cli-flag", path: "/new.yaml" } as any,
      });

      const state = await service.switchConfig(
        "/new.yaml",
        { accessToken: "token" } as any,
        "org-123",
        mockApiClient as any,
      );

      expect(state).toEqual({
        config: newConfig,
        configPath: "/new.yaml",
      });
      expect(service.getState()).toEqual(state);
    });

    test("should handle switch config errors", async () => {
      await service.initialize(
        { accessToken: "token" } as any,
        "/old.yaml",
        "org-123",
        mockApiClient as any,
      );

      vi.mocked(configLoader.loadConfiguration).mockRejectedValue(
        new Error("Config not found"),
      );

      await expect(
        service.switchConfig(
          "/bad.yaml",
          { accessToken: "token" } as any,
          "org-123",
          mockApiClient as any,
        ),
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
      await service.initialize(
        { accessToken: "token" } as any,
        "/config.yaml",
        "org-123",
        mockApiClient as any,
      );

      // Modify mock to return updated config
      const updatedConfig = { ...mockConfig, name: "updated-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: updatedConfig,
        source: { type: "cli-flag", path: "/config.yaml" } as any,
      });

      const state = await service.reload(
        { accessToken: "token" } as any,
        "org-123",
        mockApiClient as any,
      );

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
      await service.initialize(
        { accessToken: "token" } as any,
        undefined,
        "org-123",
        mockApiClient as any,
      );

      await expect(
        service.reload(
          { accessToken: "token" } as any,
          "org-123",
          mockApiClient as any,
        ),
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
      await service.initialize(
        { accessToken: "token" } as any,
        "/old.yaml",
        "org-123",
        mockApiClient as any,
      );

      // Mock service container
      vi.mocked(workos.loadAuthConfig).mockReturnValue({
        accessToken: "token",
        organizationId: "org-123",
      } as any);
      vi.mocked(serviceContainer.get).mockResolvedValue({
        apiClient: mockApiClient,
      });

      // Mock new config load
      const newConfig = { ...mockConfig, name: "new-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: newConfig,
        source: { type: "cli-flag", path: "/new.yaml" } as any,
      });

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
      await service.initialize(
        { accessToken: "token" } as any,
        "/old.yaml",
        "org-123",
        mockApiClient as any,
      );

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

  describe("getDependencies()", () => {
    test("should declare auth and apiClient dependencies", () => {
      expect(service.getDependencies()).toEqual(["auth", "apiClient"]);
    });
  });

  describe("Event Emission", () => {
    test("should emit stateChanged when switching config", async () => {
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: mockConfig as any,
        source: { type: "cli-flag", path: "/old.yaml" } as any,
      });
      await service.initialize(
        { accessToken: "token" } as any,
        "/old.yaml",
        "org-123",
        mockApiClient as any,
      );

      const listener = vi.fn();
      service.on("stateChanged", listener);

      const newConfig = { ...mockConfig, name: "new-assistant" } as any;
      vi.mocked(configLoader.loadConfiguration).mockResolvedValue({
        config: newConfig,
        source: { type: "cli-flag", path: "/new.yaml" } as any,
      });

      await service.switchConfig(
        "/new.yaml",
        { accessToken: "token" } as any,
        "org-123",
        mockApiClient as any,
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ config: newConfig, configPath: "/new.yaml" }),
        expect.objectContaining({
          config: mockConfig,
          configPath: "/old.yaml",
        }),
      );
    });

    test("should emit error on switch failure", async () => {
      await service.initialize(
        { accessToken: "token" } as any,
        "/old.yaml",
        "org-123",
        mockApiClient as any,
      );

      const errorListener = vi.fn();
      service.on("error", errorListener);

      const error = new Error("Config load failed");
      vi.mocked(configLoader.loadConfiguration).mockRejectedValue(error);

      await expect(
        service.switchConfig(
          "/bad.yaml",
          { accessToken: "token" } as any,
          "org-123",
          mockApiClient as any,
        ),
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
