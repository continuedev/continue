import { EventEmitter } from "events";

import { logger } from "../util/logger.js";

/**
 * Base abstract class for all services
 * Provides common lifecycle methods and state management
 */
export abstract class BaseService<TState> extends EventEmitter {
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
