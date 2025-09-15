import { EventEmitter } from "events";
import { vi } from "vitest";

/**
 * Mocked base service class for testing
 */
export class BaseService<TState> extends EventEmitter {
  protected serviceName: string;
  protected currentState: TState;
  private isInitialized: boolean = false;

  constructor(serviceName: string, initialState: TState) {
    super();
    this.serviceName = serviceName;
    this.currentState = initialState;
  }

  // Mock the abstract method
  doInitialize = vi.fn<any>();

  async initialize(...args: any[]): Promise<TState> {
    this.emit("initializing");
    try {
      const state = await this.doInitialize(...args);
      this.currentState = state;
      this.isInitialized = true;
      this.emit("initialized", state);
      return state;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  getState(): TState {
    return { ...this.currentState };
  }

  protected setState(newState: Partial<TState>): void {
    const previousState = this.currentState;
    this.currentState = { ...this.currentState, ...newState };
    this.emit("stateChanged", this.currentState, previousState);
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async reload(...args: any[]): Promise<TState> {
    this.isInitialized = false;
    return this.initialize(...args);
  }

  async cleanup(): Promise<void> {
    this.removeAllListeners();
    this.isInitialized = false;
  }
}

/**
 * Interface for services with dependencies
 */
export interface ServiceWithDependencies {
  getDependencies(): string[];
}

/**
 * Helper to check if a service has dependencies
 */
export function hasDependencies(
  service: any,
): service is ServiceWithDependencies {
  return !!service && typeof service.getDependencies === "function";
}
