import { EventEmitter } from 'events';
import logger from '../util/logger.js';
import { ServiceResult, ServiceState, ServiceEvents } from './types.js';

/**
 * Central service container that manages service lifecycle and dependencies
 * Uses EventEmitter for reactive updates across the application
 */
export class ServiceContainer extends EventEmitter {
  private services = new Map<string, ServiceResult<any>>();
  private factories = new Map<string, () => Promise<any>>();
  private dependencies = new Map<string, string[]>();

  constructor() {
    super();
    // Increase max listeners to handle multiple UI components
    this.setMaxListeners(50);
  }

  /**
   * Register a service factory with optional dependencies
   */
  register<T>(
    serviceName: string, 
    factory: () => Promise<T>,
    deps: string[] = []
  ): void {
    this.factories.set(serviceName, factory);
    this.dependencies.set(serviceName, deps);
    
    // Initialize with idle state
    this.services.set(serviceName, {
      value: null,
      state: 'idle',
      error: null
    });

    logger.debug(`Registered service: ${serviceName}`, { dependencies: deps });
  }

  /**
   * Get current service result (synchronous)
   */
  getSync<T>(serviceName: string): ServiceResult<T> {
    const result = this.services.get(serviceName);
    if (!result) {
      logger.warn(`Service not found: ${serviceName}`);
      return {
        value: null,
        state: 'error',
        error: new Error(`Service '${serviceName}' not registered`)
      };
    }
    return result;
  }

  /**
   * Get service value, loading if necessary (async)
   */
  async get<T>(serviceName: string): Promise<T> {
    const current = this.getSync<T>(serviceName);
    
    if (current.state === 'ready' && current.value !== null) {
      return current.value;
    }

    if (current.state === 'loading') {
      // Wait for loading to complete
      return new Promise((resolve, reject) => {
        const onReady = (value: T) => {
          this.off(`${serviceName}:ready`, onReady);
          this.off(`${serviceName}:error`, onError);
          resolve(value);
        };
        
        const onError = (error: Error) => {
          this.off(`${serviceName}:ready`, onReady);
          this.off(`${serviceName}:error`, onError);
          reject(error);
        };

        this.once(`${serviceName}:ready`, onReady);
        this.once(`${serviceName}:error`, onError);
      });
    }

    // Need to load
    return this.load<T>(serviceName);
  }

  /**
   * Load a service, handling dependencies
   */
  async load<T>(serviceName: string): Promise<T> {
    const factory = this.factories.get(serviceName);
    if (!factory) {
      const error = new Error(`No factory registered for service '${serviceName}'`);
      this.setServiceError(serviceName, error);
      throw error;
    }

    // Check if already loading
    const current = this.services.get(serviceName);
    if (current?.state === 'loading') {
      return this.get<T>(serviceName);
    }

    logger.debug(`Loading service: ${serviceName}`);
    this.setServiceState(serviceName, 'loading');

    try {
      // Load dependencies first
      const deps = this.dependencies.get(serviceName) || [];
      await Promise.all(deps.map(dep => this.load(dep)));

      // Load the service
      const value = await factory();
      
      this.setServiceValue(serviceName, value);
      logger.debug(`Service loaded successfully: ${serviceName}`);
      
      return value;
    } catch (error: any) {
      logger.error(`Failed to load service '${serviceName}':`, error);
      this.setServiceError(serviceName, error);
      throw error;
    }
  }

  /**
   * Reload a service (and dependents)
   */
  async reload<T>(serviceName: string): Promise<T> {
    logger.debug(`Reloading service: ${serviceName}`);
    
    // Find all services that depend on this one
    const dependents = Array.from(this.dependencies.entries())
      .filter(([_, deps]) => deps.includes(serviceName))
      .map(([name, _]) => name);

    // Reset this service and all dependents
    this.resetService(serviceName);
    dependents.forEach(dep => this.resetService(dep));

    // Reload
    return this.load<T>(serviceName);
  }

  /**
   * Manually set a service value (for testing or external updates)
   */
  set<T>(serviceName: string, value: T): void {
    this.setServiceValue(serviceName, value);
  }

  /**
   * Check if service is ready
   */
  isReady(serviceName: string): boolean {
    const result = this.services.get(serviceName);
    return result?.state === 'ready' && result.value !== null;
  }

  /**
   * Check if service is loading
   */
  isLoading(serviceName: string): boolean {
    const result = this.services.get(serviceName);
    return result?.state === 'loading';
  }

  /**
   * Get all service states (for debugging)
   */
  getServiceStates(): Record<string, ServiceState> {
    const states: Record<string, ServiceState> = {};
    for (const [name, result] of this.services) {
      states[name] = result.state;
    }
    return states;
  }

  /**
   * Private helper methods
   */
  private setServiceState(serviceName: string, state: ServiceState): void {
    const current = this.services.get(serviceName) || { value: null, state: 'idle', error: null };
    const updated = { ...current, state, lastUpdated: new Date() };
    this.services.set(serviceName, updated);
    this.emit(`${serviceName}:${state}`);
  }

  private setServiceValue<T>(serviceName: string, value: T): void {
    const result: ServiceResult<T> = {
      value,
      state: 'ready',
      error: null,
      lastUpdated: new Date()
    };
    
    this.services.set(serviceName, result);
    this.emit(`${serviceName}:ready`, value);
    this.emit(`${serviceName}:changed`, value);
  }

  private setServiceError(serviceName: string, error: Error): void {
    const result: ServiceResult<any> = {
      value: null,
      state: 'error',
      error,
      lastUpdated: new Date()
    };
    
    this.services.set(serviceName, result);
    this.emit(`${serviceName}:error`, error);
  }

  private resetService(serviceName: string): void {
    const result: ServiceResult<any> = {
      value: null,
      state: 'idle',
      error: null
    };
    
    this.services.set(serviceName, result);
  }
}

// Global singleton instance
export const serviceContainer = new ServiceContainer();