import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SystemMessageService } from "./SystemMessageService.js";

import { services } from "./index.js";
const toolPermissionService = services.toolPermissions;

// Mock the systemMessage module
vi.mock("../systemMessage.js", () => ({
  constructSystemMessage: vi.fn(),
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
      );
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
