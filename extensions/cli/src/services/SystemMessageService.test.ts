import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { modeService } from "./ModeService.js";
import { SystemMessageService } from "./SystemMessageService.js";

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
      const message = await service.getSystemMessage();

      expect(constructSystemMessageMock).toHaveBeenCalledWith(
        ["rule1"],
        "json",
        true,
        "normal", // Default mode
      );
      expect(message).toBe("Test system message");
    });

    it("should use updated mode when mode changes", async () => {
      constructSystemMessageMock.mockResolvedValue("Updated system message");

      await service.initialize({});

      // Simulate mode change
      modeService.emit("modeChanged", "plan", "normal");

      const message = await service.getSystemMessage();

      expect(constructSystemMessageMock).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        "plan",
      );
      expect(message).toBe("Updated system message");
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
      await service.getSystemMessage();

      expect(constructSystemMessageMock).toHaveBeenCalledWith(
        ["rule1"],
        "json",
        false,
        "normal",
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
      await service.getSystemMessage();

      expect(constructSystemMessageMock).toHaveBeenCalledWith(
        ["rule2", "rule3"],
        "json",
        undefined,
        "normal",
      );
    });
  });

  describe("mode tracking", () => {
    it("should track current mode from ModeService", async () => {
      await service.initialize({});

      expect(service.getCurrentMode()).toBe("normal");

      // Simulate mode change
      modeService.emit("modeChanged", "auto", "normal");

      expect(service.getCurrentMode()).toBe("auto");
    });

    it("should initialize with current mode from ModeService", async () => {
      // Mock modeService.getCurrentMode
      vi.spyOn(modeService, "getCurrentMode").mockReturnValue("plan");

      const newService = new SystemMessageService();
      await newService.initialize({});

      expect(newService.getCurrentMode()).toBe("plan");

      await newService.cleanup();
    });
  });

  describe("error handling", () => {
    it("should handle constructSystemMessage errors gracefully", async () => {
      constructSystemMessageMock.mockRejectedValue(
        new Error("Failed to construct"),
      );

      await service.initialize({});

      await expect(service.getSystemMessage()).rejects.toThrow(
        "Failed to construct",
      );
    });
  });
});
