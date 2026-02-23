import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { PosthogService } from "./posthogService.js";

describe("PosthogService Error Handling", () => {
  let posthogService: PosthogService;
  let consoleSpy: any;

  beforeEach(() => {
    posthogService = new PosthogService();
    // Spy on console methods but don't mock them - we want to test they don't crash
    consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should handle network errors gracefully during capture", async () => {
    // Mock the PostHog client to throw a network error
    const mockClient = {
      capture: vi.fn().mockImplementation(() => {
        throw new Error("Network error: SSL wrong version number");
      }),
    };

    // Mock the getClient method to return our mock client
    vi.spyOn(posthogService as any, "getClient").mockResolvedValue(mockClient);

    // This should not throw an error
    await expect(
      posthogService.capture("test_event", { test: "data" }),
    ).resolves.toBeUndefined();

    // Verify the client capture was called
    expect(mockClient.capture).toHaveBeenCalledWith({
      distinctId: expect.any(String),
      event: "test_event",
      properties: expect.objectContaining({
        test: "data",
        os: expect.any(String),
        extensionVersion: expect.any(String),
        ideName: "cn",
        ideType: "cli",
      }),
      sendFeatureFlags: true,
    });
  });

  it("should handle errors gracefully during shutdown", async () => {
    // Mock the PostHog client to throw an error during shutdown
    const mockClient = {
      shutdown: vi.fn().mockImplementation(() => {
        throw new Error("Network error during shutdown");
      }),
    };

    // Mock the getClient method to return our mock client
    vi.spyOn(posthogService as any, "getClient").mockResolvedValue(mockClient);

    // This should not throw an error
    await expect(posthogService.shutdown()).resolves.toBeUndefined();

    // Verify the client shutdown was called
    expect(mockClient.shutdown).toHaveBeenCalled();
  });

  it("should handle getClient errors gracefully", async () => {
    // Mock the getClient method to throw an error
    vi.spyOn(posthogService as any, "getClient").mockRejectedValue(
      new Error("Failed to initialize PostHog client"),
    );

    // This should not throw an error
    await expect(
      posthogService.capture("test_event", { test: "data" }),
    ).resolves.toBeUndefined();
  });

  it("should not capture when service is disabled", async () => {
    // Mock environment variable to disable telemetry
    const originalEnv = process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY;
    process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY = "0";

    // Create a new service instance to pick up the env var
    const disabledService = new PosthogService();

    // Mock the getClient method
    const getClientSpy = vi.spyOn(disabledService as any, "getClient");

    await disabledService.capture("test_event", { test: "data" });

    // Verify getClient was called but would return undefined due to disabled state
    expect(getClientSpy).toHaveBeenCalled();

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY;
    } else {
      process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY = originalEnv;
    }
  });
});
