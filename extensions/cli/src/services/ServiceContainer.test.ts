import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ServiceContainer } from "./ServiceContainer.js";

describe("ServiceContainer", () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up listeners to prevent memory leaks
    container?.removeAllListeners();
  });

  describe("Dependency Cascade Reloading", () => {
    test("should automatically reload all transitive dependents", async () => {
      // Setup service dependency chain: auth -> apiClient -> config -> model
      const authValue = { auth: "auth-value" };
      const apiClientValue = { apiClient: "api-client-value" };
      const configValue = { config: "config-value" };
      const modelValue = { model: "model-value" };

      let authReloadCount = 0;
      let apiClientReloadCount = 0;
      let configReloadCount = 0;
      let modelReloadCount = 0;

      // Register services with mock factories that track reload count
      container.register(
        "auth",
        async () => {
          authReloadCount++;
          return authValue;
        },
        [],
      );

      container.register(
        "apiClient",
        async () => {
          apiClientReloadCount++;
          return apiClientValue;
        },
        ["auth"],
      );

      container.register(
        "config",
        async () => {
          configReloadCount++;
          return configValue;
        },
        ["auth", "apiClient"],
      );

      container.register(
        "model",
        async () => {
          modelReloadCount++;
          return modelValue;
        },
        ["config"],
      );

      // Initial load of all services
      await container.get("model");

      // Verify initial load counts
      expect(authReloadCount).toBe(1);
      expect(apiClientReloadCount).toBe(1);
      expect(configReloadCount).toBe(1);
      expect(modelReloadCount).toBe(1);

      // Reload auth service - should cascade to all dependents
      await container.reload("auth");

      // Verify cascade reload occurred - all dependent services should reload
      expect(authReloadCount).toBe(2); // auth reloaded
      expect(apiClientReloadCount).toBe(2); // apiClient depends on auth
      expect(configReloadCount).toBe(2); // config depends on auth and apiClient
      expect(modelReloadCount).toBe(2); // model depends on config
    });

    test("should find all transitive dependents correctly", async () => {
      // Setup complex dependency graph
      container.register("serviceA", async () => ({}), []);
      container.register("serviceB", async () => ({}), ["serviceA"]);
      container.register("serviceC", async () => ({}), ["serviceA"]);
      container.register("serviceD", async () => ({}), [
        "serviceB",
        "serviceC",
      ]);
      container.register("serviceE", async () => ({}), ["serviceD"]);

      // Use reflection to access private method for testing
      const findAllDependents = (container as any).findAllDependents.bind(
        container,
      );

      const dependentsOfA = findAllDependents("serviceA");

      // serviceA should have all others as transitive dependents
      expect(dependentsOfA.sort()).toEqual([
        "serviceB",
        "serviceC",
        "serviceD",
        "serviceE",
      ]);
    });

    test("should handle circular dependencies gracefully", async () => {
      // This test ensures the findAllDependents doesn't get stuck in infinite loops

      // Setup a circular dependency (which shouldn't happen in practice but we handle it)
      container.register("serviceX", async () => ({}), ["serviceY"]);
      container.register("serviceY", async () => ({}), ["serviceX"]);

      // Use reflection to access private method for testing
      const findAllDependents = (container as any).findAllDependents.bind(
        container,
      );

      // Should not hang and should return both services as circular dependents
      const dependentsOfX = findAllDependents("serviceX");
      const dependentsOfY = findAllDependents("serviceY");

      // Both should contain each other due to circular dependency
      expect(dependentsOfX).toContain("serviceY");
      expect(dependentsOfY).toContain("serviceX");
    });

    test("should emit events during cascade reload", async () => {
      const events: string[] = [];

      container.register("parent", async () => ({ parent: true }), []);
      container.register("child", async () => ({ child: true }), ["parent"]);

      // Listen for events
      container.on("parent:loading", () => events.push("parent:loading"));
      container.on("parent:ready", () => events.push("parent:ready"));
      container.on("child:loading", () => events.push("child:loading"));
      container.on("child:ready", () => events.push("child:ready"));

      // Initial load
      await container.get("child");
      events.length = 0; // Clear events

      // Reload parent - should cascade to child
      await container.reload("parent");

      // Verify both services went through loading cycle
      expect(events).toContain("parent:loading");
      expect(events).toContain("parent:ready");
      expect(events).toContain("child:loading");
      expect(events).toContain("child:ready");
    });

    test("should preserve service state when no dependents exist", async () => {
      let reloadCount = 0;

      container.register(
        "standalone",
        async () => {
          reloadCount++;
          return { standalone: true };
        },
        [],
      );

      // Load initially
      await container.get("standalone");
      expect(reloadCount).toBe(1);

      // Reload - only this service should reload
      await container.reload("standalone");
      expect(reloadCount).toBe(2);

      // Should still be ready
      expect(container.isReady("standalone")).toBe(true);
    });
  });
});
