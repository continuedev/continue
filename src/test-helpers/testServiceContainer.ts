import { ServiceContainer } from "../services/ServiceContainer.js";
import { ServiceState } from "../services/types.js";

export interface TestServiceContainer extends ServiceContainer {
  waitForReady(...serviceNames: string[]): Promise<void>;
  waitForService(serviceName: string): Promise<any>;
  resolveService(serviceName: string, value: any): void;
  rejectService(serviceName: string, error: Error): void;
}

export function createTestServiceContainer(): TestServiceContainer {
  const container = new ServiceContainer() as TestServiceContainer;
  const serviceResolvers = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      promise?: Promise<any>;
    }
  >();

  // Override load instead of register to have more control
  container.load = async function (serviceName: string) {
    // Check if we already have a resolver for this service
    const existing = serviceResolvers.get(serviceName);
    if (existing && existing.promise) {
      return existing.promise;
    }

    // Create a controllable promise
    let promiseResolve: (value: any) => void;
    let promiseReject: (error: Error) => void;

    const promise = new Promise((resolve, reject) => {
      promiseResolve = resolve;
      promiseReject = reject;
    });

    serviceResolvers.set(serviceName, {
      resolve: promiseResolve!,
      reject: promiseReject!,
      promise,
    });

    // Update service state to loading
    const currentState = container.getSync(serviceName);
    if (currentState.state === "idle" || currentState.state === "error") {
      container.emit(`${serviceName}:loading`);
      // Manually update the internal state (we'll need to expose this)
      (container as any).services.set(serviceName, {
        value: null,
        state: "loading" as ServiceState,
        error: null,
      });
    }

    return promise;
  };

  // Helper to resolve a service on demand
  container.resolveService = function (name, value) {
    const resolver = serviceResolvers.get(name);
    if (resolver) {
      // Update internal state
      (container as any).services.set(name, {
        value,
        state: "ready" as ServiceState,
        error: null,
        lastUpdated: new Date(),
      });

      // Emit ready event
      container.emit(`${name}:ready`, value);

      // Resolve the promise
      resolver.resolve(value);
    }
  };

  // Helper to reject a service
  container.rejectService = function (name, error) {
    const resolver = serviceResolvers.get(name);
    if (resolver) {
      // Update internal state
      (container as any).services.set(name, {
        value: null,
        state: "error" as ServiceState,
        error,
        lastUpdated: new Date(),
      });

      // Emit error event
      container.emit(`${name}:error`, error);

      // Reject the promise
      resolver.reject(error);
    }
  };

  // Wait for specific services to be ready
  container.waitForReady = async function (...names) {
    const promises = names.map(
      (name) =>
        new Promise<void>((resolve) => {
          container.once(`${name}:ready`, () => resolve());
          container.once(`${name}:error`, () => resolve());
        }),
    );
    await Promise.all(promises);
  };

  // Wait for a specific service and return its value
  container.waitForService = async function (name) {
    return new Promise((resolve) => {
      container.once(`${name}:ready`, (value) => resolve(value));
      container.once(`${name}:error`, (error) => resolve(error));
    });
  };

  return container;
}
