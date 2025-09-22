import { IdeInfo } from "../index.js";
import { ShihuoTelemetryService } from "./ShihuoTelemetryService.js";

// Mock fetch
global.fetch = jest.fn();

// Mock fs
jest.mock("fs");
jest.mock("os");

describe("ShihuoTelemetryService", () => {
  let service: ShihuoTelemetryService;
  const mockIdeInfo: IdeInfo = {
    name: "vscode",
    ideType: "vscode",
    version: "1.0.0",
    remoteName: "",
    extensionVersion: "1.0.0",
    isPrerelease: false,
  };

  beforeEach(() => {
    // Clear instance
    ShihuoTelemetryService.clearInstance();
    service = ShihuoTelemetryService.getInstance();
    service.initialize(mockIdeInfo);

    // Enable service for testing
    service.configureReporting({ enabled: true });

    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("{}"),
    });
  });

  afterEach(() => {
    service.shutdown();
  });

  describe("capture", () => {
    it("should capture events and add to queue", () => {
      const event = "test_event";
      const properties = { test: "value" };
      const distinctId = "test_user";

      service.capture(event, properties, distinctId);

      const queueStatus = service.getQueueStatus();
      expect(queueStatus.eventQueueLength).toBe(1);
    });

    it("should not capture events when disabled", () => {
      service.configureReporting({ enabled: false });

      const event = "test_event";
      const properties = { test: "value" };
      const distinctId = "test_user";

      service.capture(event, properties, distinctId);

      const queueStatus = service.getQueueStatus();
      expect(queueStatus.eventQueueLength).toBe(0);
    });

    it("should capture events in test environment but not report", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      const event = "test_event";
      const properties = { test: "value" };
      const distinctId = "test_user";

      service.capture(event, properties, distinctId);

      const queueStatus = service.getQueueStatus();
      expect(queueStatus.eventQueueLength).toBe(1); // Events are captured but not reported

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("configuration", () => {
    it("should update configuration", () => {
      const newConfig = {
        enabled: false,
        reportInterval: 10000,
        batchSize: 5,
      };

      service.configureReporting(newConfig);

      const config = service.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.reportInterval).toBe(10000);
      expect(config.batchSize).toBe(5);
    });
  });

  describe("forceReport", () => {
    it("should flush queue immediately", async () => {
      const event = "test_event";
      const properties = { test: "value" };
      const distinctId = "test_user";

      service.capture(event, properties, distinctId);

      const queueStatusBefore = service.getQueueStatus();
      expect(queueStatusBefore.eventQueueLength).toBe(1);

      await service.forceReport();

      const queueStatusAfter = service.getQueueStatus();
      expect(queueStatusAfter.eventQueueLength).toBe(0);
    });
  });

  describe("device ID management", () => {
    it("should generate and persist device ID", () => {
      const queueStatus = service.getQueueStatus();
      expect(queueStatus.deviceId).toBeDefined();
      expect(typeof queueStatus.deviceId).toBe("string");
    });
  });

  describe("error handling", () => {
    it("should handle fetch errors gracefully", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development"; // Set to non-test environment

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const event = "test_event";
      const properties = { test: "value" };
      const distinctId = "test_user";

      service.capture(event, properties, distinctId);

      // Should not throw error
      await expect(service.forceReport()).resolves.not.toThrow();

      const queueStatus = service.getQueueStatus();
      expect(queueStatus.failedEventsLength).toBeGreaterThan(0);

      process.env.NODE_ENV = originalEnv;
    });

    it("should retry failed requests", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development"; // Set to non-test environment

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("{}"),
        });
      });

      const event = "test_event";
      const properties = { test: "value" };
      const distinctId = "test_user";

      service.capture(event, properties, distinctId);

      await service.forceReport();

      expect(callCount).toBe(3); // Should retry 3 times

      process.env.NODE_ENV = originalEnv;
    });
  });
});
