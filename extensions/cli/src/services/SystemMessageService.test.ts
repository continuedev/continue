import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SystemMessageService } from "./SystemMessageService.js";

import { services } from "./index.js";
const toolPermissionService = services.toolPermissions;

// Mock the systemMessage module
vi.mock("../systemMessage.js", () => ({
  constructSystemMessage: vi.fn(),
}));

// The instruction files' fingerprint: tests change it to simulate an edit
const fingerprint = { value: "AGENTS.md:1:100" };
vi.mock("../instructionFiles.js", () => ({
  instructionFilesFingerprint: vi.fn(() => fingerprint.value),
}));

// Mock the logger
vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SystemMessageService", () => {
  let service: SystemMessageService;
  let constructSystemMessageMock: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    fingerprint.value = "AGENTS.md:1:100";

    // Get mock reference
    const { constructSystemMessage } = await import("../systemMessage.js");
    constructSystemMessageMock = constructSystemMessage as any;

    // Create new service instance
    service = new SystemMessageService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe("initialization", () => {
    it("should initialize with provided configuration", async () => {
      const config = {
        additionalRules: ["rule1", "rule2"],
        format: "json" as const,
        headless: true,
      };

      const state = await service.initialize(config);

      expect(state).toEqual(config);
      expect(service.isReady()).toBe(true);
    });

    it("should initialize with empty configuration", async () => {
      const state = await service.initialize({});

      expect(state).toEqual({});
      expect(service.isReady()).toBe(true);
    });
  });

  describe("getSystemMessage", () => {
    it("should call constructSystemMessage with current configuration and mode", async () => {
      const config = {
        additionalRules: ["rule1"],
        format: "json" as const,
        headless: true,
      };

      constructSystemMessageMock.mockResolvedValue("Test system message");

      await service.initialize(config);
      const message = await service.getSystemMessage("normal");

      expect(constructSystemMessageMock).toHaveBeenCalledWith(
        "normal", // Default mode
        ["rule1"],
        "json",
        true,
        undefined,
      );
      expect(message).toBe("Test system message");
    });
  });

  describe("updateConfig", () => {
    it("should update configuration partially", async () => {
      await service.initialize({
        additionalRules: ["rule1"],
        headless: false,
      });

      service.updateConfig({
        format: "json",
      });

      constructSystemMessageMock.mockResolvedValue("Updated message");
      await service.getSystemMessage("normal");

      expect(constructSystemMessageMock).toHaveBeenCalledWith(
        "normal",
        ["rule1"],
        "json",
        false,
        undefined,
      );
    });

    it("should override existing configuration", async () => {
      await service.initialize({
        additionalRules: ["rule1"],
        format: "json" as const,
      });

      service.updateConfig({
        additionalRules: ["rule2", "rule3"],
      });

      constructSystemMessageMock.mockResolvedValue("Updated message");
      await service.getSystemMessage("normal");

      expect(constructSystemMessageMock).toHaveBeenCalledWith(
        "normal",
        ["rule2", "rule3"],
        "json",
        undefined,
        undefined,
      );
    });
  });

  describe("caching per session", () => {
    beforeEach(async () => {
      constructSystemMessageMock.mockImplementation(
        async (mode: string) => `message for ${mode}`,
      );
      await service.initialize({});
    });

    it("builds the message once and reuses it for later requests", async () => {
      expect(await service.getSystemMessage("normal")).toBe(
        "message for normal",
      );
      expect(await service.getSystemMessage("normal")).toBe(
        "message for normal",
      );
      expect(constructSystemMessageMock).toHaveBeenCalledTimes(1);
    });

    it("rebuilds on a mode switch and keeps each mode's message", async () => {
      await service.getSystemMessage("normal");
      expect(await service.getSystemMessage("plan")).toBe("message for plan");
      expect(constructSystemMessageMock).toHaveBeenCalledTimes(2);
      // Back to the first mode: its message is still cached
      await service.getSystemMessage("normal");
      await service.getSystemMessage("plan");
      expect(constructSystemMessageMock).toHaveBeenCalledTimes(2);
    });

    it("rebuilds when an instruction file changes, once", async () => {
      await service.getSystemMessage("normal");
      fingerprint.value = "AGENTS.md:2:120";
      await service.getSystemMessage("normal");
      await service.getSystemMessage("normal");
      expect(constructSystemMessageMock).toHaveBeenCalledTimes(2);
    });

    it("rebuilds after invalidate()", async () => {
      await service.getSystemMessage("normal");
      service.invalidate();
      await service.getSystemMessage("normal");
      expect(constructSystemMessageMock).toHaveBeenCalledTimes(2);
    });

    it("rebuilds after updateConfig()", async () => {
      await service.getSystemMessage("normal");
      service.updateConfig({ headless: true });
      await service.getSystemMessage("normal");
      expect(constructSystemMessageMock).toHaveBeenCalledTimes(2);
      expect(constructSystemMessageMock).toHaveBeenLastCalledWith(
        "normal",
        undefined,
        undefined,
        true,
        undefined,
      );
    });

    it("rebuilds when the config service's value changes", async () => {
      const { serviceContainer } = await import("./ServiceContainer.js");
      await service.getSystemMessage("normal");
      serviceContainer.emit("config:changed", { config: {} });
      await service.getSystemMessage("normal");
      expect(constructSystemMessageMock).toHaveBeenCalledTimes(2);
    });

    it("stops listening to the config service after cleanup", async () => {
      const { serviceContainer } = await import("./ServiceContainer.js");
      await service.getSystemMessage("normal");
      await service.cleanup();
      serviceContainer.emit("config:changed", { config: {} });
      // A fresh service after cleanup starts empty anyway; what matters is
      // that the old listener is gone
      expect(serviceContainer.listenerCount("config:changed")).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should handle constructSystemMessage errors gracefully", async () => {
      constructSystemMessageMock.mockRejectedValue(
        new Error("Failed to construct"),
      );

      await service.initialize({});

      await expect(service.getSystemMessage("normal")).rejects.toThrow(
        "Failed to construct",
      );
    });
  });
});
