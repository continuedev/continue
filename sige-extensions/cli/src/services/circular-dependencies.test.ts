import { ServiceContainer } from "./ServiceContainer.js";

import { initializeServices } from "./index.js";

describe("Service Circular Dependencies", () => {
  it("should not have circular dependencies in service setup", async () => {
    // Create a fresh container and initialize services to get real dependencies
    const testContainer = new ServiceContainer();

    // Monkey patch the global serviceContainer to capture registrations
    const originalRegister = testContainer.register.bind(testContainer);
    const serviceDependencies: Record<string, string[]> = {};

    testContainer.register = function <T>(
      serviceName: string,
      factory: () => Promise<T>,
      deps: string[] = [],
    ) {
      serviceDependencies[serviceName] = [...deps]; // Capture actual dependencies
      return originalRegister(serviceName, factory, deps);
    };

    // Import and run the real service initialization to capture dependencies
    const { serviceContainer } = await import("./index.js");
    const originalContainer = serviceContainer;

    // Temporarily replace the global container
    (global as any).serviceContainer = testContainer;

    try {
      // This will register services with their real dependencies
      await initializeServices({ headless: true });
    } catch (error) {
      // Ignore initialization errors - we just want the registration data
    } finally {
      // Restore original container
      (global as any).serviceContainer = originalContainer;
    }

    // Detect circular dependencies using topological sort
    const detectCircularDependencies = (
      dependencies: Record<string, string[]>,
    ): string[] => {
      const visited = new Set<string>();
      const recStack = new Set<string>();
      const cycle: string[] = [];

      const hasCycle = (node: string, path: string[]): boolean => {
        if (recStack.has(node)) {
          // Found a cycle - capture the cycle path
          const cycleStart = path.indexOf(node);
          cycle.push(...path.slice(cycleStart), node);
          return true;
        }

        if (visited.has(node)) {
          return false;
        }

        visited.add(node);
        recStack.add(node);

        const deps = dependencies[node] || [];
        for (const dep of deps) {
          if (hasCycle(dep, [...path, node])) {
            return true;
          }
        }

        recStack.delete(node);
        return false;
      };

      // Check each service for cycles
      for (const service of Object.keys(dependencies)) {
        if (!visited.has(service)) {
          if (hasCycle(service, [])) {
            return cycle;
          }
        }
      }

      return [];
    };

    const circularDeps = detectCircularDependencies(serviceDependencies);

    if (circularDeps.length > 0) {
      throw new Error(
        `Circular dependency detected: ${circularDeps.join(" -> ")}`,
      );
    }

    // Also verify that all services can be theoretically loaded without circular issues
    const canResolveAll = () => {
      const resolved = new Set<string>();
      const maxIterations = Object.keys(serviceDependencies).length * 2;
      let iterations = 0;

      while (
        resolved.size < Object.keys(serviceDependencies).length &&
        iterations < maxIterations
      ) {
        for (const [service, deps] of Object.entries(serviceDependencies)) {
          if (
            !resolved.has(service) &&
            deps.every((dep) => resolved.has(dep))
          ) {
            resolved.add(service);
          }
        }
        iterations++;
      }

      return resolved.size === Object.keys(serviceDependencies).length;
    };

    expect(canResolveAll()).toBe(true);
  });
});
