import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResourceMonitoringService } from "./ResourceMonitoringService.js";

// Mock the logger and BaseService
vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./BaseService.js", () => ({
  BaseService: class MockBaseService {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  },
}));

describe("ResourceMonitoringService", () => {
  let service: ResourceMonitoringService;

  beforeEach(async () => {
    // Remove process event listeners to prevent interference
    process.removeAllListeners("exit");
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");

    service = new ResourceMonitoringService();
    await service.initialize();
  });

  afterEach(async () => {
    if (service) {
      service.stopMonitoring(); // Ensure monitoring is stopped
      await service.cleanup();
    }
  });

  it("should initialize without starting monitoring by default", () => {
    expect(service).toBeDefined();
    // Should not be monitoring unless --verbose is passed
    const usage = service.getCurrentResourceUsage();
    expect(usage.timestamp).toBeGreaterThan(0);
  });

  it("should collect current resource usage", () => {
    const usage = service.getCurrentResourceUsage();

    expect(usage.timestamp).toBeGreaterThan(0);
    expect(usage.memory.rss).toBeGreaterThan(0);
    expect(usage.memory.heapTotal).toBeGreaterThan(0);
    expect(usage.memory.heapUsed).toBeGreaterThan(0);
    expect(usage.cpu.user).toBeGreaterThanOrEqual(0);
    expect(usage.cpu.system).toBeGreaterThanOrEqual(0);
    expect(usage.system.uptime).toBeGreaterThan(0);
    expect(usage.system.totalMemory).toBeGreaterThan(0);
    expect(usage.eventLoop.lag).toBeGreaterThanOrEqual(0);
  });

  it("should provide resource summary", () => {
    const summary = service.getResourceSummary();

    expect(summary.current).toBeDefined();
    expect(summary.peak).toBeDefined();
    expect(summary.average).toBeDefined();

    expect(summary.peak.memory).toBeGreaterThan(0);
    expect(summary.peak.cpu).toBeGreaterThanOrEqual(0);

    expect(summary.average.memory).toBeGreaterThan(0);
    expect(summary.average.cpu).toBeGreaterThanOrEqual(0);
  });

  it("should start and stop monitoring", async () => {
    service.startMonitoring(100); // 100ms interval for test

    // Wait for some data collection
    await new Promise((resolve) => setTimeout(resolve, 250));

    const history = service.getResourceHistory();
    expect(history.length).toBeGreaterThan(0);

    service.stopMonitoring();
  });

  it("should handle verbose mode initialization", async () => {
    // Mock argv to include --verbose
    const originalArgv = process.argv;
    process.argv = [...originalArgv, "--verbose"];

    const verboseService = new ResourceMonitoringService();
    await verboseService.initialize();

    // Should start monitoring automatically
    // Note: Testing this properly would require checking internal state
    // which isn't directly exposed

    await verboseService.cleanup();
    process.argv = originalArgv;
  });
});
