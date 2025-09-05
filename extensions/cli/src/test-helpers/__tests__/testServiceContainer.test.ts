import { vi } from "vitest";

import { createTestServiceContainer } from "../testServiceContainer.js";

describe("TestServiceContainer", () => {
  afterEach(() => {
    vi.clearAllTimers();
  });
  it("should create a container with extended methods", () => {
    const container = createTestServiceContainer();

    expect(container).toBeDefined();
    expect(container.resolveService).toBeDefined();
    expect(container.rejectService).toBeDefined();
    expect(container.waitForReady).toBeDefined();
    expect(container.waitForService).toBeDefined();
  });

  it("should allow controlled service resolution", async () => {
    const container = createTestServiceContainer();

    // Register a service
    container.register("test", () => Promise.resolve("should not resolve"));

    // Load the service - this will create a pending promise
    const loadPromise = container.load("test");

    // Service should be in loading state
    const state = container.getSync("test");
    expect(state.state).toBe("loading");

    // Resolve the service with our controlled value
    container.resolveService("test", "controlled value");

    // Wait for the load promise to complete
    const loadedValue = await loadPromise;
    expect(loadedValue).toBe("controlled value");

    // Check the resolved value
    const result = container.getSync("test");
    expect(result.state).toBe("ready");
    expect(result.value).toBe("controlled value");
  });

  it("should allow controlled service rejection", async () => {
    const container = createTestServiceContainer();

    // Register a service
    container.register("failing", () => Promise.resolve("should not resolve"));

    // Load the service and handle the rejection
    const loadPromise = container.load("failing");

    // Reject the service
    const error = new Error("Controlled failure");
    container.rejectService("failing", error);

    // Expect the load promise to reject
    await expect(loadPromise).rejects.toThrow("Controlled failure");

    // Check the error state
    const result = container.getSync("failing");
    expect(result.state).toBe("error");
    expect(result.error).toBe(error);
  });

  it("should wait for multiple services", async () => {
    const container = createTestServiceContainer();

    // Register multiple services
    container.register("service1", () => Promise.resolve());
    container.register("service2", () => Promise.resolve());
    container.register("service3", () => Promise.resolve());

    // Load all services
    container.load("service1");
    container.load("service2");
    container.load("service3");

    // Resolve them in different order
    setTimeout(() => container.resolveService("service2", "value2"), 10);
    setTimeout(() => container.resolveService("service1", "value1"), 20);
    setTimeout(() => container.resolveService("service3", "value3"), 30);

    // Wait for all to be ready
    await container.waitForReady("service1", "service2", "service3");

    // All should be ready
    expect(container.isReady("service1")).toBe(true);
    expect(container.isReady("service2")).toBe(true);
    expect(container.isReady("service3")).toBe(true);
  });

  it("should handle pre-resolved services", () => {
    const container = createTestServiceContainer();

    // Register a service that resolves immediately
    container.register("immediate", () => Promise.resolve("immediate value"));

    // The factory should be replaced with our controlled factory
    // So it should not resolve immediately
    const state = container.getSync("immediate");
    expect(state.state).toBe("idle");
  });

  it("should support waitForService helper", async () => {
    const container = createTestServiceContainer();

    // Register and load a service
    container.register("async", () => Promise.resolve());
    container.load("async");

    // Set up the wait before resolving
    const waitPromise = container.waitForService("async");

    // Resolve the service
    container.resolveService("async", "async value");

    // Wait should resolve with the value
    const value = await waitPromise;
    expect(value).toBe("async value");
  });
});
