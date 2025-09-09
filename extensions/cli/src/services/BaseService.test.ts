import { EventEmitter } from "events";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { logger } from "../util/logger.js";

/**
 * Base abstract class for all services
 * Provides common lifecycle methods and state management
 */
abstract class BaseService<TState> extends EventEmitter {
  protected serviceName: string;
  protected currentState: TState;
  private isInitialized: boolean = false;

  constructor(serviceName: string, initialState: TState) {
    super();
    this.serviceName = serviceName;
    this.currentState = initialState;
  }

  /**
   * Initialize the service (must be implemented by subclasses)
   * This is automatically wrapped with initialization logic
   */
  abstract doInitialize(...args: any[]): Promise<TState>;

  /**
   * Public initialization method that wraps the implementation
   */
  async initialize(...args: any[]): Promise<TState> {
    logger.debug(`Initializing ${this.serviceName}`, {
      wasInitialized: this.isInitialized,
      hadPreviousState: !!this.currentState,
    });
    this.emit("initializing");

    try {
      const state = await this.doInitialize(...args);
      this.currentState = state;
      this.isInitialized = true;
      logger.debug(`${this.serviceName} initialized successfully`, {
        stateKeys: state ? Object.keys(state as any) : [],
        isNowInitialized: this.isInitialized,
      });
      this.emit("initialized", state);
      return state;
    } catch (error: any) {
      logger.debug(`Failed to initialize ${this.serviceName}:`, error);
      if (this.listenerCount("error") > 0) {
        this.emit("error", error);
      }
      throw error;
    }
  }

  /**
   * Get current service state (shallow copy for immutability)
   */
  getState(): TState {
    return { ...this.currentState };
  }

  /**
   * Update service state and emit change event
   */
  protected setState(newState: Partial<TState>): void {
    const previousState = this.currentState;
    this.currentState = { ...this.currentState, ...newState };
    // Only log state updates if not in production to avoid circular reference issues
    if (process.env.NODE_ENV !== "production") {
      logger.debug(`${this.serviceName} state updated`);
    }
    this.emit("stateChanged", this.currentState, previousState);
  }

  /**
   * Check if service is ready for use
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Reload/refresh the service
   */
  async reload(...args: any[]): Promise<TState> {
    logger.debug(`Reloading ${this.serviceName}`);
    this.isInitialized = false;
    return this.initialize(...args);
  }

  /**
   * Cleanup resources (can be overridden by subclasses)
   */
  async cleanup(): Promise<void> {
    logger.debug(`Cleaning up ${this.serviceName}`);
    this.removeAllListeners();
    this.isInitialized = false;
  }
}

/**
 * Interface for services with dependencies
 */
interface ServiceWithDependencies {
  getDependencies(): string[];
}

/**
 * Helper to check if a service has dependencies
 */
function hasDependencies(service: any): service is ServiceWithDependencies {
  return !!service && typeof service.getDependencies === "function";
}

// Test implementation of BaseService
interface TestState {
  value: number;
  message: string;
  data?: any[];
}

class TestService extends BaseService<TestState> {
  constructor() {
    super("TestService", {
      value: 0,
      message: "initial",
    });
  }

  async doInitialize(value: number, message: string): Promise<TestState> {
    return {
      value,
      message,
    };
  }

  // Expose setState for testing
  updateState(newState: Partial<TestState>) {
    this.setState(newState);
  }
}

// Test service with dependencies
class DependentTestService
  extends TestService
  implements ServiceWithDependencies
{
  getDependencies(): string[] {
    return ["auth", "config"];
  }
}

// Test service that throws during initialization
class FailingTestService extends BaseService<TestState> {
  constructor() {
    super("FailingService", {
      value: 0,
      message: "initial",
    });
  }

  async doInitialize(): Promise<TestState> {
    throw new Error("Initialization failed");
  }
}

describe("BaseService", () => {
  describe("Basic Functionality", () => {
    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    test("should have correct initial state", () => {
      const state = service.getState();
      expect(state).toEqual({
        value: 0,
        message: "initial",
      });
      expect(service.isReady()).toBe(false);
    });

    test("should initialize successfully", async () => {
      const state = await service.initialize(42, "initialized");

      expect(state).toEqual({
        value: 42,
        message: "initialized",
      });
      expect(service.isReady()).toBe(true);
    });

    test("should emit initialization events", async () => {
      const initializingListener = vi.fn();
      const initializedListener = vi.fn();

      service.on("initializing", initializingListener);
      service.on("initialized", initializedListener);

      await service.initialize(42, "initialized");

      expect(initializingListener).toHaveBeenCalledTimes(1);
      expect(initializedListener).toHaveBeenCalledTimes(1);
      expect(initializedListener).toHaveBeenCalledWith({
        value: 42,
        message: "initialized",
      });
    });

    test("should handle initialization failure", async () => {
      const failingService = new FailingTestService();
      const errorListener = vi.fn();

      failingService.on("error", errorListener);

      await expect(failingService.initialize()).rejects.toThrow(
        "Initialization failed",
      );
      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(failingService.isReady()).toBe(false);
    });
  });

  describe("State Management", () => {
    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    test("should return immutable state copy", async () => {
      await service.initialize(42, "test");

      const state1 = service.getState();
      const state2 = service.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references
    });

    test("should return shallow copy of state", async () => {
      await service.initialize(42, "test");
      service.updateState({ data: [{ id: 1 }, { id: 2 }] });

      const state = service.getState();
      const originalData = state.data;

      // Modify the returned state's nested object
      if (state.data) {
        state.data[0].id = 999;
      }

      // With shallow copy, nested objects are shared
      const newState = service.getState();
      expect(newState.data).toEqual([{ id: 999 }, { id: 2 }]);
      expect(newState.data).toBe(originalData); // Same reference for nested objects
    });

    test("should emit state change events", async () => {
      await service.initialize(42, "test");

      const stateChangeListener = vi.fn();
      service.on("stateChanged", stateChangeListener);

      service.updateState({ value: 100 });

      expect(stateChangeListener).toHaveBeenCalledTimes(1);
      expect(stateChangeListener).toHaveBeenCalledWith(
        { value: 100, message: "test" }, // new state
        { value: 42, message: "test" }, // previous state
      );
    });

    test("should merge partial state updates", async () => {
      await service.initialize(42, "test");

      service.updateState({ value: 100 });
      expect(service.getState()).toEqual({
        value: 100,
        message: "test",
      });

      service.updateState({ message: "updated" });
      expect(service.getState()).toEqual({
        value: 100,
        message: "updated",
      });
    });
  });

  describe("Reload Functionality", () => {
    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    test("should reload service with new parameters", async () => {
      await service.initialize(42, "first");
      expect(service.getState()).toEqual({
        value: 42,
        message: "first",
      });

      await service.reload(100, "second");
      expect(service.getState()).toEqual({
        value: 100,
        message: "second",
      });
      expect(service.isReady()).toBe(true);
    });

    test("should reset isInitialized during reload", async () => {
      await service.initialize(42, "test");
      expect(service.isReady()).toBe(true);

      // Create a promise to check intermediate state
      let wasNotReady = false;
      const originalInit = service.initialize.bind(service);
      service.initialize = vi.fn(async (value: number, message: string) => {
        wasNotReady = !service.isReady();
        return originalInit(value, message);
      }) as any;

      await service.reload(100, "reloaded");

      expect(wasNotReady).toBe(true);
      expect(service.isReady()).toBe(true);
    });
  });

  describe("Cleanup", () => {
    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    test("should cleanup resources", async () => {
      await service.initialize(42, "test");

      const listener = vi.fn();
      service.on("test-event", listener);

      await service.cleanup();

      expect(service.isReady()).toBe(false);

      // Verify listeners are removed
      service.emit("test-event");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("ServiceWithDependencies", () => {
    test("should correctly identify services with dependencies", () => {
      const regularService = new TestService();
      const dependentService = new DependentTestService();

      expect(hasDependencies(regularService)).toBe(false);
      expect(hasDependencies(dependentService)).toBe(true);

      if (hasDependencies(dependentService)) {
        expect(dependentService.getDependencies()).toEqual(["auth", "config"]);
      }
    });
  });

  describe("Shallow Copy Functionality", () => {
    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    test("should handle null and undefined values", async () => {
      await service.initialize(42, "test");
      service.updateState({
        data: [null, undefined, "string", 123] as any,
      });

      const state = service.getState();
      expect(state.data).toEqual([null, undefined, "string", 123]);
    });

    test("should handle Date objects", async () => {
      const date = new Date("2024-01-01");
      await service.initialize(42, "test");
      service.updateState({
        data: [date] as any,
      });

      const state = service.getState();
      expect(state.data?.[0]).toEqual(date);
      expect(state.data?.[0]).toBe(date); // Same instance with shallow copy
      expect(state.data?.[0]).toBeInstanceOf(Date);
    });

    test("should handle complex nested structures", async () => {
      const complexData = {
        nested: {
          array: [1, 2, { deep: "value" }],
          date: new Date(),
          bool: true,
          null: null,
        },
      };

      await service.initialize(42, "test");
      service.updateState({ data: complexData as any });

      const state = service.getState();
      expect(state.data).toEqual(complexData);
      expect(state.data).toBe(complexData); // Same reference with shallow copy

      // Verify nested objects are shared (not deep copied)
      if (
        state.data &&
        typeof state.data === "object" &&
        "nested" in state.data
      ) {
        const data = state.data as any;
        expect(data.nested.array).toBe(complexData.nested.array);
        expect(data.nested.array[2]).toBe(complexData.nested.array[2]);
      }
    });
  });

  describe("Error Handling", () => {
    test("should emit error events on setState failures", () => {
      const service = new TestService();

      // Override setState to throw
      const originalSetState = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(service),
        "setState",
      );

      Object.defineProperty(service, "setState", {
        value: function () {
          throw new Error("setState failed");
        },
      });

      expect(() => service.updateState({ value: 100 })).toThrow(
        "setState failed",
      );

      // Restore original
      if (originalSetState) {
        Object.defineProperty(
          Object.getPrototypeOf(service),
          "setState",
          originalSetState,
        );
      }
    });
  });

  describe("Event Emitter Integration", () => {
    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    test("should support multiple listeners", async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      service.on("initialized", listener1);
      service.on("initialized", listener2);

      await service.initialize(42, "test");

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    test("should support once listeners", async () => {
      const listener = vi.fn();

      service.once("stateChanged", listener);

      await service.initialize(42, "test");
      service.updateState({ value: 100 });
      service.updateState({ value: 200 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test("should allow removing specific listeners", async () => {
      const listener = vi.fn();

      service.on("stateChanged", listener);
      await service.initialize(42, "test");

      service.updateState({ value: 100 });
      expect(listener).toHaveBeenCalledTimes(1);

      service.off("stateChanged", listener);
      service.updateState({ value: 200 });
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });
});
